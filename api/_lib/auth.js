import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "crype_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_SECRET = process.env.SESSION_SECRET || "crype-dev-session-secret";
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

async function getUser(username, password) {
  const sourceUser =
    getStorageMode() === "supabase"
      ? await findSupabaseUser(username)
      : USERS.find((user) => user.username === username && user.isActive !== false) || null;

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

function sign(value) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function encodeSession(user) {
  const payload = Buffer.from(
    JSON.stringify({
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (sign(payload) !== signature) return null;
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
  getSession,
  getStorageMode,
  getUser,
  listUsers,
  parseJsonBody,
  publicUser,
  sendJson,
  setSessionCookie,
};
