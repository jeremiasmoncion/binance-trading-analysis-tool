import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { getSession, sendJson } from "./auth.js";

const SESSION_SECRET = process.env.SESSION_SECRET || "crype-dev-session-secret";
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BINANCE_CONNECTIONS_TABLE = process.env.SUPABASE_BINANCE_TABLE || "binance_testnet_connections";
const BINANCE_TESTNET_API_URL = "https://demo-api.binance.com";

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
    throw new Error("Supabase no está configurado para Binance Demo Spot");
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

function isMissingAliasColumnError(error) {
  const message = String(error?.message || "");
  return message.includes("account_alias");
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
  if (!response.ok) throw new Error(payload.msg || "No se pudo consultar Binance Demo Spot");
  return payload;
}

async function fetchBinancePublic(path, params = {}) {
  const search = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
  );
  const response = await fetch(`${BINANCE_TESTNET_API_URL}${path}${search.toString() ? `?${search.toString()}` : ""}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.msg || "No se pudo consultar Binance Demo Spot");
  return payload;
}

async function getAuthenticatedSession(req) {
  const session = getSession(req);
  if (!session) throw new Error("Sesión no válida o vencida");
  return session;
}

async function getCredentialsForSession(req) {
  const session = await getAuthenticatedSession(req);
  const row = await getStoredConnection(session.username);
  if (!row) throw new Error("Primero conecta Binance Demo Spot desde Perfil");
  return {
    session,
    row,
    apiKey: decryptValue(row.api_key_encrypted),
    apiSecret: decryptValue(row.api_secret_encrypted),
  };
}

async function getStoredConnection(username) {
  try {
    const params = new URLSearchParams({
      select: "username,api_key_encrypted,api_secret_encrypted,account_alias,updated_at",
      username: `eq.${username}`,
      limit: "1",
    });
    const rows = await supabaseRequest(`${BINANCE_CONNECTIONS_TABLE}?${params.toString()}`);
    return rows[0] || null;
  } catch (error) {
    if (!isMissingAliasColumnError(error)) throw error;
    const fallbackParams = new URLSearchParams({
      select: "username,api_key_encrypted,api_secret_encrypted,updated_at",
      username: `eq.${username}`,
      limit: "1",
    });
    const rows = await supabaseRequest(`${BINANCE_CONNECTIONS_TABLE}?${fallbackParams.toString()}`);
    return rows[0] || null;
  }
}

async function saveConnectionForUser(username, apiKey, apiSecret, accountAlias = "") {
  try {
    const rows = await supabaseRequest(BINANCE_CONNECTIONS_TABLE, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: {
        username,
        api_key_encrypted: encryptValue(apiKey),
        api_secret_encrypted: encryptValue(apiSecret),
        account_alias: accountAlias || null,
      },
    });
    return rows?.[0] || null;
  } catch (error) {
    if (!isMissingAliasColumnError(error)) throw error;
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
    uid: account.uid || null,
    accountType: account.accountType || "SPOT",
    permissions: Array.isArray(account.permissions) ? account.permissions : [],
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
    accountAlias: row.account_alias || "",
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
  const accountAlias = String(body.accountAlias || "").trim();
  if (!apiKey || !apiSecret) throw new Error("Debes indicar API Key y Secret de Binance Demo Spot");

  const summary = await readOnlyAccountSummary(apiKey, apiSecret);
  const row = await saveConnectionForUser(session.username, apiKey, apiSecret, accountAlias);
  return {
    connected: true,
    username: session.username,
    accountAlias: row?.account_alias || accountAlias,
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

function getSymbolForAsset(asset) {
  if (!asset || asset === "USDT") return null;
  return `${asset}USDT`;
}

async function fetchReferencePrice(symbol, period) {
  if (!symbol || !period) return null;
  const days = period === "30d" ? 30 : period === "7d" ? 7 : 1;
  const klines = await fetchBinancePublic("/api/v3/klines", {
    symbol,
    interval: "1d",
    limit: days + 1,
  });
  const candle = Array.isArray(klines) && klines.length ? klines[0] : null;
  return candle ? Number(candle[4] || candle[1] || 0) : null;
}

function normalizeTrade(trade) {
  const qty = Number(trade.qty || 0);
  const price = Number(trade.price || 0);
  const commission = Number(trade.commission || 0);
  const commissionAsset = String(trade.commissionAsset || "");
  return {
    isBuyer: Boolean(trade.isBuyer),
    qty,
    price,
    value: qty * price,
    commission,
    commissionAsset,
    time: Number(trade.time || 0),
  };
}

function calculatePositionFromTrades(trades, asset) {
  let quantityHeld = 0;
  let costHeld = 0;
  let realizedPnl = 0;

  for (const rawTrade of trades.sort((a, b) => a.time - b.time)) {
    const trade = normalizeTrade(rawTrade);
    const quoteCommission = trade.commissionAsset === "USDT" ? trade.commission : 0;
    const baseCommission = trade.commissionAsset === asset ? trade.commission : 0;
    if (trade.isBuyer) {
      const netQty = Math.max(0, trade.qty - baseCommission);
      quantityHeld += netQty;
      costHeld += trade.value + quoteCommission;
      continue;
    }

    const grossSellQty = trade.qty;
    const qtyLeaving = grossSellQty;
    const avgCost = quantityHeld > 0 ? costHeld / quantityHeld : 0;
    const removedCost = avgCost * Math.min(quantityHeld, qtyLeaving);
    quantityHeld = Math.max(0, quantityHeld - qtyLeaving);
    costHeld = Math.max(0, costHeld - removedCost);
    realizedPnl += trade.value - removedCost - quoteCommission;
  }

  const avgEntryPrice = quantityHeld > 0 ? costHeld / quantityHeld : 0;
  return {
    quantityHeld,
    costHeld,
    avgEntryPrice,
    realizedPnl,
  };
}

function formatMoneyNumber(value) {
  return Number((value || 0).toFixed(8));
}

async function getPortfolioSnapshot(req, period = "1d") {
  const { session, row, apiKey, apiSecret } = await getCredentialsForSession(req);
  const account = await fetchBinanceSigned("/api/v3/account", apiKey, apiSecret, { omitZeroBalances: true });
  const balances = (account.balances || [])
    .map((balance) => {
      const free = Number(balance.free || 0);
      const locked = Number(balance.locked || 0);
      return { asset: balance.asset, free, locked, total: free + locked };
    })
    .filter((balance) => balance.total > 0);

  const assets = await Promise.all(
    balances.map(async (balance) => {
      if (balance.asset === "USDT") {
        return {
          asset: "USDT",
          symbol: "USDT",
          quantity: balance.total,
          free: balance.free,
          locked: balance.locked,
          currentPrice: 1,
          referencePrice: 1,
          marketValue: balance.total,
          investedValue: balance.total,
          pnlValue: 0,
          pnlPct: 0,
          periodChangeValue: 0,
          periodChangePct: 0,
          avgEntryPrice: 1,
          realizedPnl: 0,
          tradeCount: 0,
        };
      }

      const symbol = getSymbolForAsset(balance.asset);
      if (!symbol) return null;

      const [priceTicker, dayTicker, referencePrice, trades] = await Promise.all([
        fetchBinancePublic("/api/v3/ticker/price", { symbol }).catch(() => ({ price: "0" })),
        fetchBinancePublic("/api/v3/ticker/24hr", { symbol }).catch(() => ({ priceChangePercent: "0" })),
        fetchReferencePrice(symbol, period).catch(() => null),
        fetchBinanceSigned("/api/v3/myTrades", apiKey, apiSecret, { symbol, limit: 200 }).catch(() => []),
      ]);

      const position = calculatePositionFromTrades(Array.isArray(trades) ? trades : [], balance.asset);
      const currentPrice = Number(priceTicker.price || 0);
      const marketValue = balance.total * currentPrice;
      const investedValue = position.quantityHeld > 0
        ? balance.total * position.avgEntryPrice
        : marketValue;
      const pnlValue = marketValue - investedValue;
      const pnlPct = investedValue > 0 ? (pnlValue / investedValue) * 100 : 0;
      const refPrice = Number(referencePrice || 0) || currentPrice;
      const periodChangeValue = balance.total * (currentPrice - refPrice);
      const periodChangePct = refPrice > 0 ? ((currentPrice - refPrice) / refPrice) * 100 : Number(dayTicker.priceChangePercent || 0);

      return {
        asset: balance.asset,
        symbol,
        quantity: balance.total,
        free: balance.free,
        locked: balance.locked,
        currentPrice: formatMoneyNumber(currentPrice),
        referencePrice: formatMoneyNumber(refPrice),
        marketValue: formatMoneyNumber(marketValue),
        investedValue: formatMoneyNumber(investedValue),
        pnlValue: formatMoneyNumber(pnlValue),
        pnlPct: Number(pnlPct.toFixed(2)),
        periodChangeValue: formatMoneyNumber(periodChangeValue),
        periodChangePct: Number(periodChangePct.toFixed(2)),
        avgEntryPrice: formatMoneyNumber(position.avgEntryPrice),
        realizedPnl: formatMoneyNumber(position.realizedPnl),
        tradeCount: Array.isArray(trades) ? trades.length : 0,
      };
    })
  );

  const cleanAssets = assets.filter(Boolean).sort((a, b) => b.marketValue - a.marketValue);
  const hiddenLockedAssets = cleanAssets.filter((asset) => asset.free <= 0 && asset.locked > 0);
  const visibleAssets = cleanAssets.filter((asset) => !(asset.free <= 0 && asset.locked > 0));
  const totalValue = visibleAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const investedValue = visibleAssets.reduce((sum, asset) => sum + asset.investedValue, 0);
  const unrealizedPnl = visibleAssets.reduce((sum, asset) => sum + asset.pnlValue, 0);
  const periodChangeValue = visibleAssets.reduce((sum, asset) => sum + asset.periodChangeValue, 0);
  const periodBaseValue = totalValue - periodChangeValue;
  const periodChangePct = periodBaseValue > 0 ? (periodChangeValue / periodBaseValue) * 100 : 0;
  const cashAsset = visibleAssets.find((asset) => asset.asset === "USDT");
  const openPositions = visibleAssets.filter((asset) => asset.asset !== "USDT" && asset.quantity > 0);
  const hiddenLockedValue = hiddenLockedAssets.reduce((sum, asset) => sum + asset.marketValue, 0);

  return {
    connected: true,
    username: session.username,
    accountAlias: row.account_alias || "",
    maskedApiKey: maskApiKey(apiKey),
    summary: {
      uid: account.uid || null,
      accountType: account.accountType || "SPOT",
      permissions: Array.isArray(account.permissions) ? account.permissions : [],
      canTrade: Boolean(account.canTrade),
      canWithdraw: Boolean(account.canWithdraw),
      canDeposit: Boolean(account.canDeposit),
    },
    portfolio: {
      period,
      totalValue: formatMoneyNumber(totalValue),
      investedValue: formatMoneyNumber(investedValue),
      unrealizedPnl: formatMoneyNumber(unrealizedPnl),
      unrealizedPnlPct: investedValue > 0 ? Number(((unrealizedPnl / investedValue) * 100).toFixed(2)) : 0,
      periodChangeValue: formatMoneyNumber(periodChangeValue),
      periodChangePct: Number(periodChangePct.toFixed(2)),
      cashValue: formatMoneyNumber(cashAsset?.marketValue || 0),
      positionsValue: formatMoneyNumber(totalValue - (cashAsset?.marketValue || 0)),
      openPositionsCount: openPositions.length,
      winnersCount: openPositions.filter((asset) => asset.pnlValue > 0).length,
      hiddenLockedValue: formatMoneyNumber(hiddenLockedValue),
      hiddenLockedAssetsCount: hiddenLockedAssets.length,
      updatedAt: new Date().toISOString(),
    },
    assets: visibleAssets,
    hiddenLockedAssets,
  };
}

export {
  BINANCE_TESTNET_API_URL,
  connectBinanceTestnet,
  disconnectBinanceTestnet,
  getPortfolioSnapshot,
  getBinanceConnectionState,
  sendJson,
};
