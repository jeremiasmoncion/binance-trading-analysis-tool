import { getSession, sendJson } from "./auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WATCHLIST_TABLE = process.env.SUPABASE_WATCHLIST_TABLE || "watchlist_items";
const WATCHLIST_LISTS_TABLE = process.env.SUPABASE_WATCHLIST_LISTS_TABLE || "watchlist_lists";

function normalizeCoin(value) {
  const raw = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  if (raw.includes("/")) return raw;
  if (raw.endsWith("USDT") && raw.length > 4) {
    return `${raw.slice(0, -4)}/USDT`;
  }
  return raw;
}

function normalizeListName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40) || "Principal";
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

async function ensureDefaultList(username) {
  const body = [{ username, list_name: "Principal", is_active: true }];
  await supabaseRequest(WATCHLIST_LISTS_TABLE, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body,
  }).catch(() => null);
}

function buildGroups(metaRows, itemRows) {
  const groups = (metaRows || []).map((row) => ({
    name: normalizeListName(row.list_name),
    coins: [],
    isActive: Boolean(row.is_active),
  }));

  const groupsByName = new Map(groups.map((item) => [item.name, item]));

  (itemRows || []).forEach((row) => {
    const name = normalizeListName(row.list_name || "Principal");
    if (!groupsByName.has(name)) {
      const fallback = { name, coins: [], isActive: false };
      groups.push(fallback);
      groupsByName.set(name, fallback);
    }
    const group = groupsByName.get(name);
    const coin = normalizeCoin(row.coin);
    if (group && coin && !group.coins.includes(coin)) {
      group.coins.push(coin);
    }
  });

  if (!groups.length) {
    groups.push({ name: "Principal", coins: [], isActive: true });
  }

  if (!groups.some((item) => item.isActive)) {
    groups[0].isActive = true;
  }

  const activeListName = groups.find((item) => item.isActive)?.name || groups[0].name;
  return {
    lists: groups.map((item) => ({ ...item, isActive: item.name === activeListName })),
    activeListName,
  };
}

async function loadWatchlists(session) {
  const username = session.username;

  try {
    const listParams = new URLSearchParams({
      select: "list_name,is_active,created_at",
      username: `eq.${username}`,
      order: "created_at.asc",
    });
    const itemParams = new URLSearchParams({
      select: "coin,list_name,created_at",
      username: `eq.${username}`,
      order: "created_at.asc",
    });
    const [metaRows, itemRows] = await Promise.all([
      supabaseRequest(`${WATCHLIST_LISTS_TABLE}?${listParams.toString()}`),
      supabaseRequest(`${WATCHLIST_TABLE}?${itemParams.toString()}`),
    ]);

    if (!(metaRows || []).length) {
      await ensureDefaultList(username);
      return loadWatchlists(session);
    }

    return buildGroups(metaRows, itemRows);
  } catch {
    const params = new URLSearchParams({
      select: "coin",
      username: `eq.${username}`,
      order: "created_at.asc",
    });
    const itemRows = await supabaseRequest(`${WATCHLIST_TABLE}?${params.toString()}`);
    return {
      lists: [
        {
          name: "Principal",
          coins: Array.from(new Set((itemRows || []).map((row) => normalizeCoin(row.coin)).filter(Boolean))),
          isActive: true,
        },
      ],
      activeListName: "Principal",
    };
  }
}

async function listWatchlistScanTargets(username = null) {
  const listParams = new URLSearchParams({
    select: "username,list_name,is_active,created_at",
    order: "username.asc,created_at.asc",
  });
  const itemParams = new URLSearchParams({
    select: "username,coin,list_name,created_at",
    order: "username.asc,created_at.asc",
  });

  if (username) {
    listParams.set("username", `eq.${username}`);
    itemParams.set("username", `eq.${username}`);
  }

  const [metaRows, itemRows] = await Promise.all([
    supabaseRequest(`${WATCHLIST_LISTS_TABLE}?${listParams.toString()}`),
    supabaseRequest(`${WATCHLIST_TABLE}?${itemParams.toString()}`),
  ]);

  const grouped = new Map();
  (metaRows || []).forEach((row) => {
    const key = String(row.username || "");
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, { username: key, meta: [], items: [] });
    grouped.get(key).meta.push(row);
  });
  (itemRows || []).forEach((row) => {
    const key = String(row.username || "");
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, { username: key, meta: [], items: [] });
    grouped.get(key).items.push(row);
  });

  return Array.from(grouped.values()).map((entry) => {
    const built = buildGroups(entry.meta, entry.items);
    const active = built.lists.find((item) => item.isActive) || built.lists[0] || { name: "Principal", coins: [] };
    return {
      username: entry.username,
      activeListName: active.name,
      coins: active.coins,
      lists: built.lists,
    };
  }).filter((entry) => entry.coins.length);
}

async function listWatchlists(req) {
  const session = requireSession(req);
  return loadWatchlists(session);
}

async function replaceWatchlist(req) {
  const session = requireSession(req);
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const listName = normalizeListName(body.listName);
  const coins = Array.isArray(body.coins)
    ? Array.from(new Set(body.coins.map((item) => normalizeCoin(item)).filter(Boolean)))
    : [];

  await ensureDefaultList(session.username);

  const deleteParams = new URLSearchParams({
    username: `eq.${session.username}`,
    list_name: `eq.${listName}`,
  });
  await supabaseRequest(`${WATCHLIST_TABLE}?${deleteParams.toString()}`, { method: "DELETE" });

  if (coins.length) {
    await supabaseRequest(WATCHLIST_TABLE, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: coins.map((coin) => ({
        username: session.username,
        list_name: listName,
        coin,
      })),
    });
  }

  return loadWatchlists(session);
}

async function createWatchlist(req) {
  const session = requireSession(req);
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const name = normalizeListName(body.name);

  const current = await loadWatchlists(session);
  if (current.lists.some((item) => item.name === name)) {
    return current;
  }

  await supabaseRequest(`${WATCHLIST_LISTS_TABLE}?username=eq.${session.username}`, { method: "PATCH", body: { is_active: false } }).catch(() => null);
  await supabaseRequest(WATCHLIST_LISTS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [{ username: session.username, list_name: name, is_active: true }],
  });

  return loadWatchlists(session);
}

async function updateWatchlist(req) {
  const session = requireSession(req);
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const name = normalizeListName(body.name);
  const nextName = body.nextName ? normalizeListName(body.nextName) : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : null;

  if (isActive) {
    await supabaseRequest(`${WATCHLIST_LISTS_TABLE}?username=eq.${session.username}`, { method: "PATCH", body: { is_active: false } }).catch(() => null);
  }

  if (nextName && nextName !== name) {
    await supabaseRequest(`${WATCHLIST_LISTS_TABLE}?username=eq.${session.username}&list_name=eq.${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: { list_name: nextName },
    });
    await supabaseRequest(`${WATCHLIST_TABLE}?username=eq.${session.username}&list_name=eq.${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: { list_name: nextName },
    }).catch(() => null);
  }

  if (isActive !== null) {
    await supabaseRequest(`${WATCHLIST_LISTS_TABLE}?username=eq.${session.username}&list_name=eq.${encodeURIComponent(nextName || name)}`, {
      method: "PATCH",
      body: { is_active: isActive },
    });
  }

  return loadWatchlists(session);
}

async function deleteWatchlist(req) {
  const session = requireSession(req);
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const name = normalizeListName(body.name);
  const current = await loadWatchlists(session);
  if (current.lists.length <= 1) {
    throw new Error("No puedes eliminar la única lista de seguimiento");
  }

  await supabaseRequest(`${WATCHLIST_TABLE}?username=eq.${session.username}&list_name=eq.${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  await supabaseRequest(`${WATCHLIST_LISTS_TABLE}?username=eq.${session.username}&list_name=eq.${encodeURIComponent(name)}`, {
    method: "DELETE",
  });

  const updated = await loadWatchlists(session);
  if (!updated.lists.some((item) => item.isActive)) {
    const fallback = updated.lists[0]?.name || "Principal";
    await supabaseRequest(`${WATCHLIST_LISTS_TABLE}?username=eq.${session.username}`, { method: "PATCH", body: { is_active: false } }).catch(() => null);
    await supabaseRequest(`${WATCHLIST_LISTS_TABLE}?username=eq.${session.username}&list_name=eq.${encodeURIComponent(fallback)}`, {
      method: "PATCH",
      body: { is_active: true },
    }).catch(() => null);
    return loadWatchlists(session);
  }

  return updated;
}

export {
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  listWatchlistScanTargets,
  replaceWatchlist,
  sendJson,
  updateWatchlist,
};
