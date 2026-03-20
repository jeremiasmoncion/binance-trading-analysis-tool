import { getSession, parseJsonBody, sendJson } from "./auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BOTS_TABLE = process.env.SUPABASE_BOTS_TABLE || "bot_profiles";

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase no está configurado para los bots");
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
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function requireSession(req) {
  const session = getSession(req);
  if (!session) throw new Error("Sesión no válida o vencida");
  return session;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

function createDefaultBotPayload(overrides = {}) {
  const createdAt = overrides.createdAt || nowIso();
  const slug = slugify(overrides.slug || overrides.name || overrides.id || "signal-bot");
  const id = String(overrides.id || slug || `signal-bot-${Date.now()}`);
  const name = String(overrides.name || "Signal Bot Core").trim() || "Signal Bot Core";
  const primaryPair = String(overrides.primaryPair || "BTC/USDT").trim() || "BTC/USDT";
  const allocatedUsd = Number(overrides.allocatedUsd || 0);

  return {
    id,
    slug,
    name,
    description: String(
      overrides.description
      || "Bot principal para consumir señales del sistema con políticas estándar y ejecución controlada.",
    ),
    identity: overrides.identity || {
      family: slug,
      operatingProfile: overrides.aiPolicy?.unrestrictedModeEnabled ? "unrestricted-ai" : overrides.automationMode === "auto" ? "automatic" : "manual-assisted",
      ownerScope: overrides.identity?.ownerScope || "system",
      isTemplate: overrides.identity?.isTemplate ?? true,
      isIsolated: overrides.identity?.isIsolated ?? Boolean(overrides.aiPolicy?.isolationScope === "isolated"),
    },
    status: String(overrides.status || "active"),
    executionEnvironment: String(overrides.executionEnvironment || "paper"),
    automationMode: String(overrides.automationMode || "assist"),
    capital: {
      allocatedUsd,
      availableUsd: Number(overrides.availableUsd ?? allocatedUsd),
      accountingScope: slug,
    },
    workspaceSettings: {
      primaryPair,
      rangeLower: overrides.workspaceSettings?.rangeLower ?? (overrides.rangeLower == null ? null : Number(overrides.rangeLower)),
      rangeUpper: overrides.workspaceSettings?.rangeUpper ?? (overrides.rangeUpper == null ? null : Number(overrides.rangeUpper)),
      gridCount: overrides.workspaceSettings?.gridCount ?? (overrides.gridCount == null ? null : Number(overrides.gridCount)),
      stopLossPct: overrides.workspaceSettings?.stopLossPct ?? (overrides.stopLossPct == null ? 5 : Number(overrides.stopLossPct)),
      takeProfitPct: overrides.workspaceSettings?.takeProfitPct ?? (overrides.takeProfitPct == null ? 10 : Number(overrides.takeProfitPct)),
      autoCompoundProfits: overrides.workspaceSettings?.autoCompoundProfits ?? Boolean(overrides.autoCompoundProfits),
    },
    generalSettings: overrides.generalSettings || {
      defaultTradingPair: primaryPair,
      defaultExchange: "Binance",
      baseCurrency: "USDT",
      orderSizeType: "fixed",
      autoRestartOnError: true,
      autoCompoundProfits: false,
      paperTradingMode: false,
      smartOrderRouting: true,
      antiSlippageProtection: true,
      executionSpeed: 50,
      apiRateLimit: 1200,
      maxConcurrentBots: 15,
      tradingScheduleEnabled: false,
      startTime: "09:00 AM",
      endTime: "05:00 PM",
      activeDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      timezone: "UTC",
    },
    notificationSettings: overrides.notificationSettings || {
      emailEnabled: true,
      emailAddress: "john@example.com",
      telegramEnabled: true,
      telegramHandle: "@johndoe",
      discordConnected: false,
      discordLabel: "Not connected",
      pushEnabled: true,
      pushLabel: "Mobile app",
      tradeExecuted: true,
      takeProfitHit: true,
      stopLossTriggered: true,
      botStatusChange: true,
      dailySummary: false,
      errorAlerts: true,
    },
    universePolicy: overrides.universePolicy || {
      kind: "watchlist",
      watchlistIds: [],
      symbols: [primaryPair],
      filters: {
        preferredTimeframes: ["15m", "1h", "4h"],
      },
    },
    stylePolicy: overrides.stylePolicy || {
      dominantStyle: "swing",
      allowedStyles: ["swing"],
      multiStyleEnabled: false,
    },
    timeframePolicy: overrides.timeframePolicy || {
      preferredTimeframes: ["1h", "4h"],
      allowedTimeframes: ["15m", "1h", "4h"],
    },
    strategyPolicy: overrides.strategyPolicy || {
      allowedStrategyIds: [],
      preferredStrategyIds: ["signals"],
      adaptiveAdjustmentsEnabled: true,
    },
    riskPolicy: overrides.riskPolicy || {
      maxPositionUsd: Number(overrides.maxPositionUsd || 250),
      maxOpenPositions: Number(overrides.maxOpenPositions || 3),
      maxDailyLossPct: Number(overrides.maxDailyLossPct || 2),
      maxDrawdownPct: Number(overrides.maxDrawdownPct || 8),
      cooldownAfterLosses: Number(overrides.cooldownAfterLosses || 2),
      maxSymbolExposurePct: Number(overrides.maxSymbolExposurePct || 35),
      realExecutionRequiresApproval: true,
    },
    executionPolicy: overrides.executionPolicy || {
      canOpenPositions: true,
      suggestionsOnly: false,
      requiresHumanApproval: true,
      autoExecutionEnabled: false,
      realExecutionEnabled: false,
    },
    aiPolicy: overrides.aiPolicy || {
      analystEnabled: true,
      adjusterEnabled: false,
      supervisorEnabled: true,
      unrestrictedModeEnabled: false,
      requiresConfirmationFor: ["strategy-change", "risk-change", "real-order", "capital-change"],
      isolationScope: "standard",
    },
    overlapPolicy: overrides.overlapPolicy || {
      observationOverlap: "allow",
      signalOverlap: "dedupe-by-origin",
      executionOverlap: "allow-with-approval",
      arbitrationMode: "priority",
      priority: Number(overrides.priority || 50),
      exclusiveUniverse: false,
    },
    memoryPolicy: overrides.memoryPolicy || {
      familySharingEnabled: false,
      globalLearningEnabled: false,
      allowPromotionToShared: false,
      requiresApprovalForSharedLearning: true,
      familyScope: "bot-family",
    },
    localMemory: overrides.localMemory || {
      layer: "local",
      lastUpdatedAt: null,
      signalCount: 0,
      decisionCount: 0,
      outcomeCount: 0,
      notes: [],
    },
    familyMemory: overrides.familyMemory || {
      layer: "family",
      lastUpdatedAt: null,
      signalCount: 0,
      decisionCount: 0,
      outcomeCount: 0,
      notes: [],
    },
    globalMemory: overrides.globalMemory || {
      layer: "global",
      lastUpdatedAt: null,
      signalCount: 0,
      decisionCount: 0,
      outcomeCount: 0,
      notes: [],
    },
    performance: overrides.performance || {
      updatedAt: null,
      closedSignals: 0,
      winRate: 0,
      realizedPnlUsd: 0,
      avgPnlUsd: 0,
      avgHoldMinutes: null,
      bestSymbol: null,
      worstSymbol: null,
    },
    audit: overrides.audit || {
      lastDecisionAt: null,
      lastExecutionAt: null,
      lastPolicyChangeAt: null,
    },
    activity: overrides.activity || {
      lastSignalConsumedAt: null,
      lastSignalLayer: null,
      lastDecisionAction: null,
      lastDecisionStatus: null,
      lastDecisionSymbol: null,
      lastDecisionSource: null,
      pendingCount: 0,
      approvedCount: 0,
      blockedCount: 0,
      executedCount: 0,
      recentDecisionIds: [],
      recentSymbols: [],
    },
    tags: Array.isArray(overrides.tags) && overrides.tags.length ? overrides.tags : ["system", "signals"],
    priority: Number(overrides.priority || 50),
    createdAt,
    updatedAt: overrides.updatedAt || createdAt,
  };
}

function normalizeBotPayload(value) {
  if (!value || typeof value !== "object") {
    return createDefaultBotPayload({});
  }

  const source = value;
  return createDefaultBotPayload({
    ...source,
    id: source.id,
    slug: source.slug,
    name: source.name,
    description: source.description,
    status: source.status,
    executionEnvironment: source.executionEnvironment,
    automationMode: source.automationMode,
    identity: source.identity,
    allocatedUsd: source.capital?.allocatedUsd,
    availableUsd: source.capital?.availableUsd,
    primaryPair: source.workspaceSettings?.primaryPair || source.universePolicy?.symbols?.[0] || "BTC/USDT",
    rangeLower: source.workspaceSettings?.rangeLower,
    rangeUpper: source.workspaceSettings?.rangeUpper,
    gridCount: source.workspaceSettings?.gridCount,
    stopLossPct: source.workspaceSettings?.stopLossPct,
    takeProfitPct: source.workspaceSettings?.takeProfitPct,
    autoCompoundProfits: source.workspaceSettings?.autoCompoundProfits,
    generalSettings: source.generalSettings,
    notificationSettings: source.notificationSettings,
    universePolicy: source.universePolicy,
    stylePolicy: source.stylePolicy,
    timeframePolicy: source.timeframePolicy,
    executionPolicy: source.executionPolicy,
    aiPolicy: source.aiPolicy,
    overlapPolicy: source.overlapPolicy,
    memoryPolicy: source.memoryPolicy,
    familyMemory: source.familyMemory,
    globalMemory: source.globalMemory,
    audit: source.audit,
    activity: source.activity,
    maxPositionUsd: source.riskPolicy?.maxPositionUsd,
    maxOpenPositions: source.riskPolicy?.maxOpenPositions,
    maxDailyLossPct: source.riskPolicy?.maxDailyLossPct,
    maxDrawdownPct: source.riskPolicy?.maxDrawdownPct,
    cooldownAfterLosses: source.riskPolicy?.cooldownAfterLosses,
    maxSymbolExposurePct: source.riskPolicy?.maxSymbolExposurePct,
    riskPolicy: source.riskPolicy,
    priority: source.priority,
    tags: source.tags,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    performance: source.performance,
    localMemory: source.localMemory,
    strategyPolicy: source.strategyPolicy,
  });
}

function rowToBot(row) {
  return normalizeBotPayload({
    ...(row?.bot_payload && typeof row.bot_payload === "object" ? row.bot_payload : {}),
    id: row?.bot_id,
    slug: row?.slug,
    name: row?.name,
    status: row?.status,
    createdAt: row?.created_at,
    updatedAt: row?.updated_at,
  });
}

function botToRow(username, bot) {
  const normalized = normalizeBotPayload(bot);
  return {
    username: String(username || "").trim(),
    bot_id: normalized.id,
    slug: normalized.slug,
    name: normalized.name,
    status: normalized.status,
    bot_payload: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

async function listBotRowsForUser(username) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    order: "created_at.asc",
  });
  return (await supabaseRequest(`${BOTS_TABLE}?${params.toString()}`)) || [];
}

async function ensureSeedBotForUser(username) {
  const currentRows = await listBotRowsForUser(username);
  if (currentRows.length) return currentRows;

  const seedBot = createDefaultBotPayload({
    id: "signal-bot-core",
    slug: "signal-bot-core",
    name: "Signal Bot Core",
    primaryPair: "BTC/USDT",
    status: "active",
    automationMode: "assist",
    tags: ["system", "signals", "phase-3"],
  });

  await supabaseRequest(BOTS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [botToRow(username, seedBot)],
  });

  return listBotRowsForUser(username);
}

async function listBots(req) {
  const session = requireSession(req);
  const rows = await ensureSeedBotForUser(session.username);
  return {
    bots: rows.map(rowToBot),
    lastHydratedAt: nowIso(),
  };
}

async function createBot(req) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  const sourceName = String(body?.name || "").trim() || `Signal Bot ${Date.now()}`;
  const baseSlug = slugify(body?.slug || sourceName || "signal-bot");
  const uniqueId = `${baseSlug}-${Date.now()}`;
  const bot = createDefaultBotPayload({
    id: uniqueId,
    slug: baseSlug,
    name: sourceName,
    primaryPair: body?.workspaceSettings?.primaryPair || body?.primaryPair || "BTC/USDT",
    allocatedUsd: body?.capital?.allocatedUsd || body?.allocatedUsd || 0,
    availableUsd: body?.capital?.availableUsd || body?.availableUsd || 0,
    rangeLower: body?.workspaceSettings?.rangeLower,
    rangeUpper: body?.workspaceSettings?.rangeUpper,
    gridCount: body?.workspaceSettings?.gridCount,
    stopLossPct: body?.workspaceSettings?.stopLossPct,
    takeProfitPct: body?.workspaceSettings?.takeProfitPct,
    autoCompoundProfits: body?.workspaceSettings?.autoCompoundProfits,
    status: body?.status || "draft",
    executionEnvironment: body?.executionEnvironment || "paper",
    automationMode: body?.automationMode || "observe",
    description: body?.description,
    tags: Array.isArray(body?.tags) ? body.tags : undefined,
  });

  const rows = await supabaseRequest(BOTS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [botToRow(session.username, bot)],
  });

  return {
    bot: rowToBot(rows?.[0] || botToRow(session.username, bot)),
  };
}

async function updateBot(req, botId) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(session.username)}`,
    bot_id: `eq.${String(botId)}`,
    limit: "1",
  });
  const existingRows = await supabaseRequest(`${BOTS_TABLE}?${params.toString()}`);
  const existingRow = existingRows?.[0];
  if (!existingRow) {
    throw new Error("No se encontró el bot solicitado");
  }

  const existingBot = rowToBot(existingRow);
  const nextBot = normalizeBotPayload({
    ...existingBot,
    ...body,
    identity: body?.identity ? { ...existingBot.identity, ...body.identity } : existingBot.identity,
    capital: body?.capital ? { ...existingBot.capital, ...body.capital } : existingBot.capital,
    workspaceSettings: body?.workspaceSettings
      ? { ...existingBot.workspaceSettings, ...body.workspaceSettings }
      : existingBot.workspaceSettings,
    generalSettings: body?.generalSettings
      ? { ...existingBot.generalSettings, ...body.generalSettings }
      : existingBot.generalSettings,
    notificationSettings: body?.notificationSettings
      ? { ...existingBot.notificationSettings, ...body.notificationSettings }
      : existingBot.notificationSettings,
    universePolicy: body?.universePolicy
      ? {
          ...existingBot.universePolicy,
          ...body.universePolicy,
          watchlistIds: body.universePolicy.watchlistIds || existingBot.universePolicy.watchlistIds,
          symbols: body.universePolicy.symbols || existingBot.universePolicy.symbols,
          filters: body.universePolicy.filters
            ? { ...(existingBot.universePolicy.filters || {}), ...body.universePolicy.filters }
            : existingBot.universePolicy.filters,
        }
      : existingBot.universePolicy,
    stylePolicy: body?.stylePolicy ? { ...existingBot.stylePolicy, ...body.stylePolicy } : existingBot.stylePolicy,
    timeframePolicy: body?.timeframePolicy
      ? { ...existingBot.timeframePolicy, ...body.timeframePolicy }
      : existingBot.timeframePolicy,
    riskPolicy: body?.riskPolicy ? { ...existingBot.riskPolicy, ...body.riskPolicy } : existingBot.riskPolicy,
    strategyPolicy: body?.strategyPolicy ? { ...existingBot.strategyPolicy, ...body.strategyPolicy } : existingBot.strategyPolicy,
    executionPolicy: body?.executionPolicy
      ? { ...existingBot.executionPolicy, ...body.executionPolicy }
      : existingBot.executionPolicy,
    aiPolicy: body?.aiPolicy ? { ...existingBot.aiPolicy, ...body.aiPolicy } : existingBot.aiPolicy,
    overlapPolicy: body?.overlapPolicy ? { ...existingBot.overlapPolicy, ...body.overlapPolicy } : existingBot.overlapPolicy,
    memoryPolicy: body?.memoryPolicy ? { ...existingBot.memoryPolicy, ...body.memoryPolicy } : existingBot.memoryPolicy,
    performance: body?.performance ? { ...existingBot.performance, ...body.performance } : existingBot.performance,
    localMemory: body?.localMemory ? { ...existingBot.localMemory, ...body.localMemory } : existingBot.localMemory,
    familyMemory: body?.familyMemory ? { ...existingBot.familyMemory, ...body.familyMemory } : existingBot.familyMemory,
    globalMemory: body?.globalMemory ? { ...existingBot.globalMemory, ...body.globalMemory } : existingBot.globalMemory,
    audit: body?.audit ? { ...existingBot.audit, ...body.audit } : existingBot.audit,
    activity: body?.activity
      ? {
          ...existingBot.activity,
          ...body.activity,
          recentDecisionIds: body.activity.recentDecisionIds || existingBot.activity.recentDecisionIds,
          recentSymbols: body.activity.recentSymbols || existingBot.activity.recentSymbols,
        }
      : existingBot.activity,
    updatedAt: nowIso(),
  });

  const updateParams = new URLSearchParams({
    username: `eq.${String(session.username)}`,
    bot_id: `eq.${String(botId)}`,
  });

  const rows = await supabaseRequest(`${BOTS_TABLE}?${updateParams.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: botToRow(session.username, nextBot),
  });

  return {
    bot: rowToBot(rows?.[0] || botToRow(session.username, nextBot)),
  };
}

export {
  createBot,
  listBots,
  sendJson,
  updateBot,
};
