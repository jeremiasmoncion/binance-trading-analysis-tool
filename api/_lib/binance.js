import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { getSession, sendJson } from "./auth.js";

const SESSION_SECRET = process.env.SESSION_SECRET || "crype-dev-session-secret";
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BINANCE_CONNECTIONS_TABLE = process.env.SUPABASE_BINANCE_TABLE || "binance_testnet_connections";
const BINANCE_TESTNET_API_URL = "https://testnet.binance.vision";

function getEncryptionKey() {
  return createHash("sha256").update(SESSION_SECRET).digest();
}

function encryptValue(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptValue(payload) {
  if (!payload) return "";
  const [ivHex, tagHex, dataHex] = String(payload).split(":");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase no está configurado para Binance Testnet");
  }

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

function maskApiKey(apiKey) {
  if (!apiKey) return "";
  return apiKey.length <= 8 ? `${apiKey.slice(0, 2)}***${apiKey.slice(-2)}` : `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function signQuery(secret, params) {
  return createHmac("sha256", secret).update(params).digest("hex");
}

async function fetchBinanceSigned(path, apiKey, apiSecret, params = {}) {
  const search = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    timestamp: String(Date.now()),
  });
  search.set("signature", signQuery(apiSecret, search.toString()));

  const response = await fetch(`${BINANCE_TESTNET_API_URL}${path}?${search.toString()}`, {
    headers: { "X-MBX-APIKEY": apiKey },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.msg || "No se pudo consultar Binance Testnet");
  return payload;
}

async function getAuthenticatedSession(req) {
  const session = getSession(req);
  if (!session) throw new Error("Sesión no válida o vencida");
  return session;
}

async function getStoredConnection(username) {
  const params = new URLSearchParams({
    select: "username,api_key_encrypted,api_secret_encrypted,updated_at",
    username: `eq.${username}`,
    limit: "1",
  });
  const rows = await supabaseRequest(`${BINANCE_CONNECTIONS_TABLE}?${params.toString()}`);
  return rows[0] || null;
}

async function saveConnectionForUser(username, apiKey, apiSecret) {
  const rows = await supabaseRequest(BINANCE_CONNECTIONS_TABLE, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: {
      username,
      api_key_encrypted: encryptValue(apiKey),
      api_secret_encrypted: encryptValue(apiSecret),
    },
  });
  return rows?.[0] || null;
}

async function deleteConnectionForUser(username) {
  const params = new URLSearchParams({ username: `eq.${username}` });
  await supabaseRequest(`${BINANCE_CONNECTIONS_TABLE}?${params.toString()}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

async function readOnlyAccountSummary(apiKey, apiSecret) {
  const [account, openOrders] = await Promise.all([
    fetchBinanceSigned("/api/v3/account", apiKey, apiSecret, { omitZeroBalances: true }),
    fetchBinanceSigned("/api/v3/openOrders", apiKey, apiSecret),
  ]);

  const balances = (account.balances || [])
    .map((balance) => {
      const free = Number(balance.free || 0);
      const locked = Number(balance.locked || 0);
      return { asset: balance.asset, free, locked, total: free + locked };
    })
    .filter((balance) => balance.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return {
    canTrade: Boolean(account.canTrade),
    canWithdraw: Boolean(account.canWithdraw),
    canDeposit: Boolean(account.canDeposit),
    balances,
    openOrdersCount: Array.isArray(openOrders) ? openOrders.length : 0,
    updatedAt: new Date().toISOString(),
  };
}

async function getBinanceConnectionState(req) {
  const session = await getAuthenticatedSession(req);
  const row = await getStoredConnection(session.username);
  if (!row) return { connected: false, username: session.username };

  const apiKey = decryptValue(row.api_key_encrypted);
  const apiSecret = decryptValue(row.api_secret_encrypted);
  const summary = await readOnlyAccountSummary(apiKey, apiSecret);
  return {
    connected: true,
    username: session.username,
    maskedApiKey: maskApiKey(apiKey),
    updatedAt: row.updated_at || summary.updatedAt,
    summary,
  };
}

async function connectBinanceTestnet(req) {
  const session = await getAuthenticatedSession(req);
  const body = req.body && typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  const apiKey = String(body.apiKey || "").trim();
  const apiSecret = String(body.apiSecret || "").trim();
  if (!apiKey || !apiSecret) throw new Error("Debes indicar API Key y Secret de Binance Testnet");

  const summary = await readOnlyAccountSummary(apiKey, apiSecret);
  const row = await saveConnectionForUser(session.username, apiKey, apiSecret);
  return {
    connected: true,
    username: session.username,
    maskedApiKey: maskApiKey(apiKey),
    updatedAt: row?.updated_at || summary.updatedAt,
    summary,
  };
}

async function disconnectBinanceTestnet(req) {
  const session = await getAuthenticatedSession(req);
  await deleteConnectionForUser(session.username);
  return { success: true };
}

export {
  BINANCE_TESTNET_API_URL,
  connectBinanceTestnet,
  disconnectBinanceTestnet,
  getBinanceConnectionState,
  sendJson,
};
