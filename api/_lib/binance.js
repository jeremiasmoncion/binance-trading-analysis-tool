import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { getSession, sendJson } from "./auth.js";

const SESSION_SECRET = process.env.SESSION_SECRET || "crype-dev-session-secret";
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BINANCE_CONNECTIONS_TABLE = process.env.SUPABASE_BINANCE_TABLE || "binance_testnet_connections";
const EXECUTION_ORDERS_TABLE = process.env.SUPABASE_EXECUTION_ORDERS_TABLE || "execution_orders";
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

async function fetchBinanceSigned(path, apiKey, apiSecret, params = {}, requestOptions = {}) {
  const search = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    timestamp: String(Date.now()),
  });
  search.set("signature", signQuery(apiSecret, search.toString()));

  const response = await fetch(`${BINANCE_TESTNET_API_URL}${path}?${search.toString()}`, {
    method: requestOptions.method || "GET",
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
  return getCredentialsForUsername(session.username, session);
}

async function getCredentialsForUsername(username, sessionOverride = null) {
  const normalizedUsername = String(username || "").trim();
  const row = await getStoredConnection(normalizedUsername);
  if (!row) throw new Error("Primero conecta Binance Demo Spot desde Perfil");
  return {
    session: sessionOverride || { username: normalizedUsername },
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
      order: "updated_at.desc.nullslast",
      limit: "1",
    });
    const rows = await supabaseRequest(`${BINANCE_CONNECTIONS_TABLE}?${params.toString()}`);
    return rows[0] || null;
  } catch (error) {
    if (!isMissingAliasColumnError(error)) throw error;
    const fallbackParams = new URLSearchParams({
      select: "username,api_key_encrypted,api_secret_encrypted,updated_at",
      username: `eq.${username}`,
      order: "updated_at.desc.nullslast",
      limit: "1",
    });
    const rows = await supabaseRequest(`${BINANCE_CONNECTIONS_TABLE}?${fallbackParams.toString()}`);
    return rows[0] || null;
  }
}

async function saveConnectionForUser(username, apiKey, apiSecret, accountAlias = "") {
  const existingRow = await getStoredConnection(username).catch(() => null);

  if (existingRow) {
    const params = new URLSearchParams({ username: `eq.${username}` });
    try {
      const rows = await supabaseRequest(`${BINANCE_CONNECTIONS_TABLE}?${params.toString()}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: {
          api_key_encrypted: encryptValue(apiKey),
          api_secret_encrypted: encryptValue(apiSecret),
          account_alias: accountAlias || null,
        },
      });
      return rows?.[0] || null;
    } catch (error) {
      if (!isMissingAliasColumnError(error)) throw error;
      const rows = await supabaseRequest(`${BINANCE_CONNECTIONS_TABLE}?${params.toString()}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: {
          api_key_encrypted: encryptValue(apiKey),
          api_secret_encrypted: encryptValue(apiSecret),
        },
      });
      return rows?.[0] || null;
    }
  }

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
  let summary = null;
  let connectionIssue = "";
  try {
    summary = await readOnlyAccountSummary(apiKey, apiSecret);
  } catch (error) {
    connectionIssue = error instanceof Error ? error.message : "No se pudo validar Binance Demo Spot";
  }
  return {
    connected: true,
    snapshotMode: "full",
    username: session.username,
    accountAlias: row.account_alias || "",
    maskedApiKey: maskApiKey(apiKey),
    updatedAt: row.updated_at || summary?.updatedAt || new Date().toISOString(),
    summary: summary || {
      uid: null,
      accountType: "SPOT",
      permissions: [],
      canTrade: false,
      canWithdraw: false,
      canDeposit: false,
      balances: [],
      openOrdersCount: 0,
      updatedAt: row.updated_at || new Date().toISOString(),
    },
    connectionIssue: connectionIssue || undefined,
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
    orderId: Number(trade.orderId || 0),
    originLabel: "Manual usuario",
    sourceType: "manual-user",
  };
}

function normalizeOrder(order) {
  const origQty = Number(order.origQty || 0);
  const executedQty = Number(order.executedQty || 0);
  const price = Number(order.price || 0);
  const stopPrice = Number(order.stopPrice || 0);
  const quoteQty = Number(order.cummulativeQuoteQty || 0);
  return {
    orderId: Number(order.orderId || 0),
    clientOrderId: String(order.clientOrderId || ""),
    symbol: String(order.symbol || ""),
    side: String(order.side || "BUY"),
    type: String(order.type || "MARKET"),
    status: String(order.status || "NEW"),
    price,
    stopPrice,
    origQty,
    executedQty,
    quoteQty,
    time: Number(order.time || 0),
    updateTime: Number(order.updateTime || order.time || 0),
    originLabel: "Manual usuario",
    sourceType: "manual-user",
  };
}

async function listExecutionOrderLinks(username) {
  const params = new URLSearchParams({
    select: "signal_id,order_id,origin,linked_order_ids,response_payload",
    username: `eq.${String(username)}`,
    limit: "200",
    order: "created_at.desc",
  });
  return supabaseRequest(`${EXECUTION_ORDERS_TABLE}?${params.toString()}`).catch(() => []);
}

function buildExecutionOriginIndex(rows) {
  const byOrderId = new Map();
  (rows || []).forEach((row) => {
    const origin = row.origin === "watcher" ? "Desde señales" : row.signal_id ? "Desde señales" : "Manual usuario";
    const sourceType = row.origin === "watcher" ? "signals-auto" : row.signal_id ? "signals-manual" : "manual-user";
    const linkIds = [];
    const primaryId = Number(row.order_id || row.response_payload?.order?.orderId || 0);
    if (primaryId) linkIds.push(primaryId);
    const linked = row.linked_order_ids && typeof row.linked_order_ids === "object" ? row.linked_order_ids : {};
    const protectionIds = Array.isArray(linked.protectionOrderIds) ? linked.protectionOrderIds : [];
    protectionIds.forEach((item) => {
      const id = Number(item || 0);
      if (id) linkIds.push(id);
    });
    linkIds.forEach((id) => {
      if (!byOrderId.has(id)) {
        byOrderId.set(id, { originLabel: origin, sourceType });
      }
    });
  });
  return byOrderId;
}

function calculatePositionFromTrades(trades, asset) {
  let quantityHeld = 0;
  let costHeld = 0;
  let realizedPnl = 0;
  const tradeSummaries = [];

  for (const rawTrade of trades.sort((a, b) => a.time - b.time)) {
    const trade = normalizeTrade(rawTrade);
    const quoteCommission = trade.commissionAsset === "USDT" ? trade.commission : 0;
    const baseCommission = trade.commissionAsset === asset ? trade.commission : 0;
    if (trade.isBuyer) {
      const netQty = Math.max(0, trade.qty - baseCommission);
      quantityHeld += netQty;
      costHeld += trade.value + quoteCommission;
      tradeSummaries.push({
        symbol: String(rawTrade.symbol || ""),
        side: "BUY",
        qty: formatMoneyNumber(trade.qty),
        price: formatMoneyNumber(trade.price),
        value: formatMoneyNumber(trade.value),
        commission: formatMoneyNumber(trade.commission),
        commissionAsset: trade.commissionAsset,
        time: trade.time,
        orderId: trade.orderId || undefined,
        realizedPnl: 0,
      });
      continue;
    }

    const grossSellQty = trade.qty;
    const qtyLeaving = grossSellQty;
    const avgCost = quantityHeld > 0 ? costHeld / quantityHeld : 0;
    const removedCost = avgCost * Math.min(quantityHeld, qtyLeaving);
    quantityHeld = Math.max(0, quantityHeld - qtyLeaving);
    costHeld = Math.max(0, costHeld - removedCost);
    const realizedTradePnl = trade.value - removedCost - quoteCommission;
    realizedPnl += realizedTradePnl;
    tradeSummaries.push({
      symbol: String(rawTrade.symbol || ""),
      side: "SELL",
      qty: formatMoneyNumber(trade.qty),
      price: formatMoneyNumber(trade.price),
      value: formatMoneyNumber(trade.value),
      commission: formatMoneyNumber(trade.commission),
      commissionAsset: trade.commissionAsset,
      time: trade.time,
      orderId: trade.orderId || undefined,
      realizedPnl: formatMoneyNumber(realizedTradePnl),
    });
  }

  const avgEntryPrice = quantityHeld > 0 ? costHeld / quantityHeld : 0;
  return {
    quantityHeld,
    costHeld,
    avgEntryPrice,
    realizedPnl,
    tradeSummaries,
  };
}

function formatMoneyNumber(value) {
  return Number((value || 0).toFixed(8));
}

function estimateUsdValueForAsset(asset, amount, assetPriceByCode = new Map()) {
  const normalizedAsset = String(asset || "").toUpperCase();
  const normalizedAmount = Number(amount || 0);
  if (!normalizedAmount) return 0;
  if (normalizedAsset === "USDT" || normalizedAsset === "USDC" || normalizedAsset === "FDUSD" || normalizedAsset === "BUSD" || normalizedAsset === "TUSD" || normalizedAsset === "DAI") {
    return formatMoneyNumber(normalizedAmount);
  }
  const price = Number(assetPriceByCode.get(normalizedAsset) || 0);
  return formatMoneyNumber(normalizedAmount * price);
}

function normalizeAccountMovement(raw, type, assetPriceByCode = new Map()) {
  const asset = String(raw.coin || raw.asset || "").toUpperCase();
  const amount = Number(raw.amount || 0);
  const time = Number(raw.insertTime || raw.completeTime || raw.applyTime || raw.successTime || 0);
  const idSeed = String(raw.id || raw.txId || raw.tranId || `${type}-${asset}-${time}-${amount}`);
  return {
    id: idSeed,
    type,
    asset,
    amount: formatMoneyNumber(amount),
    estimatedUsdValue: estimateUsdValueForAsset(asset, amount, assetPriceByCode),
    status: String(raw.status || raw.transferStatus || raw.completeStatus || "unknown"),
    time,
    network: String(raw.network || raw.transferType || ""),
    address: String(raw.address || raw.addressTag || ""),
    txId: String(raw.txId || raw.id || ""),
  };
}

async function fetchAccountMovements(apiKey, apiSecret, assetPriceByCode = new Map()) {
  const [depositsPayload, withdrawalsPayload] = await Promise.all([
    fetchBinanceSigned("/sapi/v1/capital/deposit/hisrec", apiKey, apiSecret, { limit: 20 }).catch(() => []),
    fetchBinanceSigned("/sapi/v1/capital/withdraw/history", apiKey, apiSecret, { limit: 20 }).catch(() => []),
  ]);

  const deposits = Array.isArray(depositsPayload)
    ? depositsPayload.map((item) => normalizeAccountMovement(item, "deposit", assetPriceByCode))
    : [];
  const withdrawals = Array.isArray(withdrawalsPayload)
    ? withdrawalsPayload.map((item) => normalizeAccountMovement(item, "withdrawal", assetPriceByCode))
    : [];

  return [...deposits, ...withdrawals]
    .filter((item) => item.asset && item.time)
    .sort((a, b) => b.time - a.time)
    .slice(0, 30);
}

async function getPortfolioLiveSnapshotFromCredentials({ session, row, apiKey, apiSecret }, period = "1d") {
  const account = await fetchBinanceSigned("/api/v3/account", apiKey, apiSecret, { omitZeroBalances: true });
  const openOrdersPayload = await fetchBinanceSigned("/api/v3/openOrders", apiKey, apiSecret).catch(() => []);
  const openOrders = Array.isArray(openOrdersPayload) ? openOrdersPayload.map(normalizeOrder) : [];
  const balances = (account.balances || [])
    .map((balance) => {
      const free = Number(balance.free || 0);
      const locked = Number(balance.locked || 0);
      return { asset: balance.asset, free, locked, total: free + locked };
    })
    .filter((balance) => balance.total > 0);

  const trackedSymbols = Array.from(
    new Set(
      [
        ...balances.map((balance) => getSymbolForAsset(balance.asset)).filter(Boolean),
        ...openOrders.map((order) => order.symbol).filter(Boolean),
      ].filter(Boolean)
    )
  );

  const executionOrderLinks = await listExecutionOrderLinks(session.username);
  const executionOriginByOrderId = buildExecutionOriginIndex(executionOrderLinks);

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
          realizedPnl: 0,
          periodChangeValue: 0,
          periodChangePct: 0,
          avgEntryPrice: 1,
          tradeCount: 0,
        };
      }

      const symbol = getSymbolForAsset(balance.asset);
      if (!symbol) return null;

      const [priceTicker, dayTicker, referencePrice] = await Promise.all([
        fetchBinancePublic("/api/v3/ticker/price", { symbol }).catch(() => ({ price: "0" })),
        fetchBinancePublic("/api/v3/ticker/24hr", { symbol }).catch(() => ({ priceChangePercent: "0" })),
        fetchReferencePrice(symbol, period).catch(() => null),
      ]);

      const currentPrice = Number(priceTicker.price || 0);
      const marketValue = balance.total * currentPrice;
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
        investedValue: formatMoneyNumber(marketValue),
        pnlValue: 0,
        pnlPct: 0,
        realizedPnl: 0,
        periodChangeValue: formatMoneyNumber(periodChangeValue),
        periodChangePct: Number(periodChangePct.toFixed(2)),
        avgEntryPrice: 0,
        tradeCount: 0,
      };
    })
  );

  const cleanAssets = assets.filter(Boolean).sort((a, b) => b.marketValue - a.marketValue);
  const hiddenLockedAssets = cleanAssets.filter((asset) => asset.free <= 0 && asset.locked > 0);
  const visibleAssets = cleanAssets.filter((asset) => !(asset.free <= 0 && asset.locked > 0));
  const totalValue = visibleAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const periodChangeValue = visibleAssets.reduce((sum, asset) => sum + asset.periodChangeValue, 0);
  const periodBaseValue = totalValue - periodChangeValue;
  const periodChangePct = periodBaseValue > 0 ? (periodChangeValue / periodBaseValue) * 100 : 0;
  const cashAsset = visibleAssets.find((asset) => asset.asset === "USDT");
  const openPositions = visibleAssets.filter((asset) => asset.asset !== "USDT" && asset.quantity > 0);
  const hiddenLockedValue = hiddenLockedAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const normalizedOpenOrders = openOrders
    .map((order) => ({
      ...order,
      ...(executionOriginByOrderId.get(Number(order.orderId || 0)) || {}),
    }))
    .sort((a, b) => b.updateTime - a.updateTime)
    .slice(0, 20);

  return {
    connected: true,
    snapshotMode: "live",
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
      investedValue: formatMoneyNumber(totalValue),
      realizedPnl: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      totalPnl: 0,
      periodChangeValue: formatMoneyNumber(periodChangeValue),
      periodChangePct: Number(periodChangePct.toFixed(2)),
      cashValue: formatMoneyNumber(cashAsset?.marketValue || 0),
      positionsValue: formatMoneyNumber(totalValue - (cashAsset?.marketValue || 0)),
      openPositionsCount: openPositions.length,
      winnersCount: 0,
      hiddenLockedValue: formatMoneyNumber(hiddenLockedValue),
      hiddenLockedAssetsCount: hiddenLockedAssets.length,
      updatedAt: new Date().toISOString(),
    },
    assets: visibleAssets,
    hiddenLockedAssets,
    accountMovements: [],
    openOrders: normalizedOpenOrders,
    recentOrders: [],
    recentTrades: [],
  };
}

async function getPortfolioSnapshot(req, period = "1d", mode = "full") {
  const session = await getAuthenticatedSession(req);
  return getPortfolioSnapshotForUsername(session.username, period, mode);
}

async function getPortfolioSnapshotForUsername(username, period = "1d", mode = "full") {
  const normalizedUsername = String(username || "").trim();
  const row = await getStoredConnection(normalizedUsername).catch(() => null);
  if (!row) {
    return buildFallbackPortfolioSnapshot({
      username: normalizedUsername,
      period,
      connected: false,
      accountAlias: "",
      reason: "Conecta Binance Demo Spot desde Perfil.",
    });
  }

  try {
    const credentials = {
      session: { username: normalizedUsername },
      row,
      apiKey: decryptValue(row.api_key_encrypted),
      apiSecret: decryptValue(row.api_secret_encrypted),
    };
    if (mode === "live") {
      return await getPortfolioLiveSnapshotFromCredentials(credentials, period);
    }
    return await getPortfolioSnapshotFromCredentials(credentials, period);
  } catch (error) {
    return buildFallbackPortfolioSnapshot({
      username: normalizedUsername,
      period,
      connected: true,
      accountAlias: row.account_alias || "",
      maskedApiKey: maskApiKey(decryptValue(row.api_key_encrypted)),
      reason: error instanceof Error ? error.message : "No se pudo leer Binance Demo Spot ahora mismo.",
    });
  }
}

function buildFallbackPortfolioSnapshot({ username, period, connected, accountAlias, maskedApiKey = "", reason = "" }) {
  return {
    connected,
    snapshotMode: "full",
    username,
    accountAlias,
    maskedApiKey,
    summary: {
      uid: null,
      accountType: connected ? "SPOT" : reason || "Sin conexión",
      permissions: [],
      canTrade: false,
      canWithdraw: false,
      canDeposit: false,
    },
    portfolio: {
      period,
      totalValue: 0,
      investedValue: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      totalPnl: 0,
      periodChangeValue: 0,
      periodChangePct: 0,
      cashValue: 0,
      positionsValue: 0,
      openPositionsCount: 0,
      winnersCount: 0,
      hiddenLockedValue: 0,
      hiddenLockedAssetsCount: 0,
      updatedAt: new Date().toISOString(),
    },
    assets: [],
    hiddenLockedAssets: [],
    accountMovements: [],
    openOrders: [],
    recentOrders: [],
    recentTrades: [],
    connectionIssue: reason || undefined,
  };
}

async function getPortfolioSnapshotFromCredentials({ session, row, apiKey, apiSecret }, period = "1d") {
  const account = await fetchBinanceSigned("/api/v3/account", apiKey, apiSecret, { omitZeroBalances: true });
  const openOrdersPayload = await fetchBinanceSigned("/api/v3/openOrders", apiKey, apiSecret).catch(() => []);
  const openOrders = Array.isArray(openOrdersPayload) ? openOrdersPayload.map(normalizeOrder) : [];
  const balances = (account.balances || [])
    .map((balance) => {
      const free = Number(balance.free || 0);
      const locked = Number(balance.locked || 0);
      return { asset: balance.asset, free, locked, total: free + locked };
    })
    .filter((balance) => balance.total > 0);

  const trackedSymbols = Array.from(
    new Set(
      [
        ...balances.map((balance) => getSymbolForAsset(balance.asset)).filter(Boolean),
        ...openOrders.map((order) => order.symbol).filter(Boolean),
      ].filter(Boolean)
    )
  );
  const executionOrderLinks = await listExecutionOrderLinks(session.username);
  const executionOriginByOrderId = buildExecutionOriginIndex(executionOrderLinks);

  const symbolHistory = await Promise.all(
    trackedSymbols.map(async (symbol) => {
      const [trades, orders] = await Promise.all([
        fetchBinanceSigned("/api/v3/myTrades", apiKey, apiSecret, { symbol, limit: 200 }).catch(() => []),
        fetchBinanceSigned("/api/v3/allOrders", apiKey, apiSecret, { symbol, limit: 50 }).catch(() => []),
      ]);
      return {
        symbol,
        trades: Array.isArray(trades) ? trades : [],
        orders: Array.isArray(orders) ? orders : [],
      };
    })
  );

  const tradeHistoryBySymbol = new Map(symbolHistory.map((item) => [item.symbol, item.trades]));
  const orderHistoryBySymbol = new Map(symbolHistory.map((item) => [item.symbol, item.orders]));

  const symbolPositions = new Map();
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
          realizedPnl: 0,
          periodChangeValue: 0,
          periodChangePct: 0,
          avgEntryPrice: 1,
          tradeCount: 0,
        };
      }

      const symbol = getSymbolForAsset(balance.asset);
      if (!symbol) return null;

      const [priceTicker, dayTicker, referencePrice, trades] = await Promise.all([
        fetchBinancePublic("/api/v3/ticker/price", { symbol }).catch(() => ({ price: "0" })),
        fetchBinancePublic("/api/v3/ticker/24hr", { symbol }).catch(() => ({ priceChangePercent: "0" })),
        fetchReferencePrice(symbol, period).catch(() => null),
        Promise.resolve(tradeHistoryBySymbol.get(symbol) || []),
      ]);

      const position = calculatePositionFromTrades(Array.isArray(trades) ? trades : [], balance.asset);
      symbolPositions.set(symbol, position);
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
        realizedPnl: formatMoneyNumber(position.realizedPnl),
        periodChangeValue: formatMoneyNumber(periodChangeValue),
        periodChangePct: Number(periodChangePct.toFixed(2)),
        avgEntryPrice: formatMoneyNumber(position.avgEntryPrice),
        tradeCount: Array.isArray(trades) ? trades.length : 0,
      };
    })
  );

  const cleanAssets = assets.filter(Boolean).sort((a, b) => b.marketValue - a.marketValue);
  const hiddenLockedAssets = cleanAssets.filter((asset) => asset.free <= 0 && asset.locked > 0);
  const visibleAssets = cleanAssets.filter((asset) => !(asset.free <= 0 && asset.locked > 0));
  const assetPriceByCode = new Map(visibleAssets.map((asset) => [asset.asset, Number(asset.currentPrice || 0)]));
  const totalValue = visibleAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const investedValue = visibleAssets.reduce((sum, asset) => sum + asset.investedValue, 0);
  const realizedPnl = visibleAssets.reduce((sum, asset) => sum + asset.realizedPnl, 0);
  const unrealizedPnl = visibleAssets.reduce((sum, asset) => sum + asset.pnlValue, 0);
  const periodChangeValue = visibleAssets.reduce((sum, asset) => sum + asset.periodChangeValue, 0);
  const periodBaseValue = totalValue - periodChangeValue;
  const periodChangePct = periodBaseValue > 0 ? (periodChangeValue / periodBaseValue) * 100 : 0;
  const cashAsset = visibleAssets.find((asset) => asset.asset === "USDT");
  const openPositions = visibleAssets.filter((asset) => asset.asset !== "USDT" && asset.quantity > 0);
  const hiddenLockedValue = hiddenLockedAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const recentTrades = symbolHistory
    .flatMap((item) => {
      const position = symbolPositions.get(item.symbol);
      return position?.tradeSummaries || [];
    })
    .map((trade) => ({
      ...trade,
      ...(executionOriginByOrderId.get(Number(trade.orderId || 0)) || {}),
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 20);
  const recentOrders = symbolHistory
    .flatMap((item) => item.orders.map((order) => {
      const normalized = normalizeOrder(order);
      return {
        ...normalized,
        ...(executionOriginByOrderId.get(Number(normalized.orderId || 0)) || {}),
      };
    }))
    .filter((order) => order.status !== "NEW" && order.status !== "PARTIALLY_FILLED")
    .sort((a, b) => b.updateTime - a.updateTime)
    .slice(0, 20);
  const normalizedOpenOrders = openOrders
    .map((order) => ({
      ...order,
      ...(executionOriginByOrderId.get(Number(order.orderId || 0)) || {}),
    }))
    .sort((a, b) => b.updateTime - a.updateTime)
    .slice(0, 20);
  const accountMovements = await fetchAccountMovements(apiKey, apiSecret, assetPriceByCode);

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
      realizedPnl: formatMoneyNumber(realizedPnl),
      unrealizedPnl: formatMoneyNumber(unrealizedPnl),
      unrealizedPnlPct: investedValue > 0 ? Number(((unrealizedPnl / investedValue) * 100).toFixed(2)) : 0,
      totalPnl: formatMoneyNumber(realizedPnl + unrealizedPnl),
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
    accountMovements,
    openOrders: normalizedOpenOrders,
    recentOrders,
    recentTrades,
  };
}

export {
  BINANCE_TESTNET_API_URL,
  connectBinanceTestnet,
  disconnectBinanceTestnet,
  fetchBinancePublic,
  fetchBinanceSigned,
  getCredentialsForSession,
  getCredentialsForUsername,
  getPortfolioSnapshot,
  getPortfolioSnapshotForUsername,
  getBinanceConnectionState,
  sendJson,
};
