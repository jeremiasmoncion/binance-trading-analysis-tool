import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "crype_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_SECRET = process.env.SESSION_SECRET || "crype-dev-session-secret";
const REALTIME_CORE_BRIDGE_TTL_SECONDS = Number(process.env.REALTIME_CORE_BRIDGE_TTL_SECONDS || 60 * 30);
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_USERS_TABLE = process.env.SUPABASE_USERS_TABLE || "app_users";
const DEFAULT_PASSWORD_ITERATIONS = 120000;

const USERS = [
  { username: "jeremias", password: "1212", role: "admin", displayName: "Jeremias", isActive: true },
  { username: "yeudy", password: "1212", role: "admin", displayName: "Yeudy", isActive: true },
];

function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function publicUser(user) {
  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName || user.display_name,
  };
}

function sessionUser(user) {
  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName || user.display_name,
  };
}

function getStorageMode() {
  return SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "seed";
}

function verifyPassword(password, user) {
  if (typeof user.password === "string") return user.password === password;
  if (!user.password_hash || !user.password_salt) return false;

  const iterations = Number(user.password_iterations || DEFAULT_PASSWORD_ITERATIONS);
  const derived = pbkdf2Sync(password, user.password_salt, iterations, 32, "sha256");
  const expected = Buffer.from(user.password_hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase request failed (${response.status}): ${details || "sin detalles"}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function findSupabaseUser(username) {
  const params = new URLSearchParams({
    select: "username,display_name,role,password_hash,password_salt,password_iterations,is_active",
    username: `eq.${username}`,
    limit: "1",
  });
  const users = await supabaseRequest(`${SUPABASE_USERS_TABLE}?${params.toString()}`, {
    headers: { Prefer: "count=exact" },
  });
  return users.find((user) => user.is_active !== false) || null;
}

function hashPassword(password, salt = randomBytes(16).toString("hex"), iterations = DEFAULT_PASSWORD_ITERATIONS) {
  const passwordHash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return {
    passwordHash,
    passwordSalt: salt,
    passwordIterations: iterations,
  };
}

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

async function getUser(username, password) {
  const normalizedIdentifier = normalizeIdentifier(username);
  const sourceUser =
    getStorageMode() === "supabase"
      ? await findSupabaseUser(normalizedIdentifier)
      : USERS.find((user) => user.username === normalizedIdentifier && user.isActive !== false) || null;

  if (!sourceUser || !verifyPassword(password, sourceUser)) return null;
  return sourceUser;
}

async function listUsers() {
  if (getStorageMode() === "supabase") {
    const params = new URLSearchParams({
      select: "username,display_name,role,is_active",
      order: "username.asc",
    });
    const users = await supabaseRequest(`${SUPABASE_USERS_TABLE}?${params.toString()}`);
    return users.filter((user) => user.is_active !== false).map(publicUser);
  }

  return USERS.filter((user) => user.isActive !== false).map(publicUser);
}

async function createUser({ displayName, email, password }) {
  if (getStorageMode() !== "supabase") {
    throw new Error("El registro de usuarios requiere una base de datos externa activa");
  }

  const normalizedEmail = normalizeIdentifier(email);
  const cleanName = String(displayName || "").trim();
  const cleanPassword = String(password || "");

  if (cleanName.length < 2) throw new Error("El nombre debe tener al menos 2 caracteres");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Debes usar un correo valido");
  if (cleanPassword.length < 4) throw new Error("La contraseña debe tener al menos 4 caracteres");

  const existingUser = await findSupabaseUser(normalizedEmail);
  if (existingUser) throw new Error("Ya existe un usuario con ese correo");

  const { passwordHash, passwordSalt, passwordIterations } = hashPassword(cleanPassword);
  const created = await supabaseRequest(SUPABASE_USERS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      username: normalizedEmail,
      display_name: cleanName,
      role: "generic",
      password_hash: passwordHash,
      password_salt: passwordSalt,
      password_iterations: passwordIterations,
      is_active: true,
    },
  });

  return created?.[0] || null;
}

function sign(value, scope = "session") {
  return createHmac("sha256", SESSION_SECRET).update(`${scope}:${value}`).digest("hex");
}

function encodeSession(user) {
  const normalizedUser = sessionUser(user);
  const payload = Buffer.from(
    JSON.stringify({
      username: normalizedUser.username,
      role: normalizedUser.role,
      displayName: normalizedUser.displayName,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token, scope = "session") {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (sign(payload, scope) !== signature) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.exp || Date.now() > session.exp) return null;
    return session;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        if (index === -1) return [cookie, ""];
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      }),
  );
}

function getSession(req) {
  const cookies = parseCookies(req);
  return decodeSession(cookies[SESSION_COOKIE]);
}

function parseBearerToken(req) {
  const authorizationHeader = String(req?.headers?.authorization || req?.headers?.Authorization || "").trim();
  if (!authorizationHeader.toLowerCase().startsWith("bearer ")) return "";
  return authorizationHeader.slice(7).trim();
}

function createRealtimeCoreBridgeToken(session, ttlSeconds = REALTIME_CORE_BRIDGE_TTL_SECONDS) {
  const normalizedSession = sessionUser(session);
  const expiresAt = Date.now() + Math.max(60, Number(ttlSeconds) || REALTIME_CORE_BRIDGE_TTL_SECONDS) * 1000;
  const payload = Buffer.from(
    JSON.stringify({
      username: normalizedSession.username,
      role: normalizedSession.role,
      displayName: normalizedSession.displayName,
      exp: expiresAt,
      scope: "realtime-core-bridge",
    }),
  ).toString("base64url");
  return {
    token: `${payload}.${sign(payload, "realtime-core-bridge")}`,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function decodeRealtimeCoreBridgeToken(token) {
  const payload = decodeSession(token, "realtime-core-bridge");
  if (!payload || payload.scope !== "realtime-core-bridge") return null;
  return payload;
}

function getRealtimeCoreBridgeSession(reqOrToken) {
  const token = typeof reqOrToken === "string"
    ? reqOrToken
    : String(
      parseBearerToken(reqOrToken)
        || reqOrToken?.query?.token
        || reqOrToken?.url?.searchParams?.get?.("token")
        || "",
    ).trim();
  return decodeRealtimeCoreBridgeToken(token);
}

function resolveRealtimeCoreSession(req) {
  return getRealtimeCoreBridgeSession(req) || getSession(req);
}

function setSessionCookie(res, user) {
  const token = encodeSession(user);
  const cookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}; Secure`;
  res.setHeader("Set-Cookie", cookie);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

export {
  clearSessionCookie,
  createRealtimeCoreBridgeToken,
  createUser,
  getSession,
  getStorageMode,
  getRealtimeCoreBridgeSession,
  getUser,
  listUsers,
  parseJsonBody,
  publicUser,
  resolveRealtimeCoreSession,
  sendJson,
  setSessionCookie,
};
