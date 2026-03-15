import { getSession, sendJson } from "./auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WATCHLIST_TABLE = process.env.SUPABASE_WATCHLIST_TABLE || "watchlist_items";

function normalizeCoin(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.includes("/")) return raw;
  if (raw.endsWith("USDT") && raw.length > 4) {
    return `${raw.slice(0, -4)}/USDT`;
  }
  return raw;
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase no está configurado para el watchlist");
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

function requireSession(req) {
  const session = getSession(req);
  if (!session) throw new Error("Sesión no válida o vencida");
  return session;
}

async function listWatchlist(req) {
  const session = requireSession(req);
  const params = new URLSearchParams({
    select: "coin",
    username: `eq.${session.username}`,
    order: "created_at.asc",
  });
  const rows = await supabaseRequest(`${WATCHLIST_TABLE}?${params.toString()}`);
  return Array.from(new Set((rows || []).map((row) => normalizeCoin(row.coin)).filter(Boolean)));
}

async function replaceWatchlist(req) {
  const session = requireSession(req);
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const coins = Array.isArray(body.coins)
    ? Array.from(new Set(body.coins.map((item) => normalizeCoin(item)).filter(Boolean)))
    : [];

  const deleteParams = new URLSearchParams({
    username: `eq.${session.username}`,
  });
  await supabaseRequest(`${WATCHLIST_TABLE}?${deleteParams.toString()}`, { method: "DELETE" });

  if (!coins.length) return [];

  const rows = await supabaseRequest(WATCHLIST_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: coins.map((coin) => ({
      username: session.username,
      coin,
    })),
  });

  return (rows || []).map((row) => row.coin).filter(Boolean);
}

export {
  listWatchlist,
  replaceWatchlist,
  sendJson,
};
