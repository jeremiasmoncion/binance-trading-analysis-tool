const crypto = require("crypto");

const SESSION_COOKIE = "crype_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_SECRET = process.env.SESSION_SECRET || "crype-dev-session-secret";

const USERS = [
  { username: "jeremias", password: "1212", role: "admin", displayName: "Jeremias" },
  { username: "yeudy", password: "1212", role: "admin", displayName: "Yeudy" },
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
    displayName: user.displayName,
  };
}

function getUser(username, password) {
  return USERS.find((user) => user.username === username && user.password === password) || null;
}

function listUsers() {
  return USERS.map(publicUser);
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
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

module.exports = {
  clearSessionCookie,
  getSession,
  getUser,
  listUsers,
  parseJsonBody,
  publicUser,
  sendJson,
  setSessionCookie,
};
