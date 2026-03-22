import { getSession, parseJsonBody, sendJson } from "./auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BOTS_TABLE = process.env.SUPABASE_BOTS_TABLE || "bot_profiles";
const SUPPORTED_BOT_TYPES = new Set(["signal-bot"]);
const VALID_AUTOMATION_MODES = new Set(["observe", "assist", "auto"]);
const VALID_EXECUTION_ENVIRONMENTS = new Set(["paper", "demo", "real"]);
const VALID_UNIVERSE_KINDS = new Set(["watchlist", "custom-list", "hybrid", "market-filter"]);
const VALID_TIMEFRAMES = new Set(["1m", "3m", "5m", "10m", "15m", "30m", "45m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]);
const CLIENT_MUTABLE_BOT_FIELDS = new Set([
  "name",
  "botType",
  "executionAccount",
  "description",
  "identity",
  "status",
  "executionEnvironment",
  "automationMode",
  "capital",
  "workspaceSettings",
  "generalSettings",
  "notificationSettings",
  "universePolicy",
  "stylePolicy",
  "timeframePolicy",
  "strategyPolicy",
  "riskPolicy",
  "executionPolicy",
  "aiPolicy",
  "overlapPolicy",
  "memoryPolicy",
  "tags",
  "priority",
]);
const CLIENT_MUTABLE_IDENTITY_FIELDS = new Set(["family", "operatingProfile", "ownerScope", "isIsolated"]);
const CLIENT_MUTABLE_EXECUTION_ACCOUNT_FIELDS = new Set(["id", "label", "provider", "environment"]);
const CLIENT_MUTABLE_CAPITAL_FIELDS = new Set(["allocatedUsd", "availableUsd", "accountingScope"]);
const CLIENT_MUTABLE_WORKSPACE_FIELDS = new Set([
  "primaryPair",
  "rangeLower",
  "rangeUpper",
  "gridCount",
  "stopLossPct",
  "takeProfitPct",
  "autoCompoundProfits",
]);
const CLIENT_MUTABLE_GENERAL_SETTINGS_FIELDS = new Set([
  "defaultTradingPair",
  "defaultExchange",
  "baseCurrency",
  "orderSizeType",
  "autoRestartOnError",
  "autoCompoundProfits",
  "paperTradingMode",
  "smartOrderRouting",
  "antiSlippageProtection",
  "executionSpeed",
  "apiRateLimit",
  "maxConcurrentBots",
  "tradingScheduleEnabled",
  "startTime",
  "endTime",
  "activeDays",
  "timezone",
]);
const CLIENT_MUTABLE_NOTIFICATION_FIELDS = new Set([
  "emailEnabled",
  "emailAddress",
  "telegramEnabled",
  "telegramHandle",
  "discordConnected",
  "discordLabel",
  "pushEnabled",
  "pushLabel",
  "tradeExecuted",
  "takeProfitHit",
  "stopLossTriggered",
  "botStatusChange",
  "dailySummary",
  "errorAlerts",
]);
const CLIENT_MUTABLE_UNIVERSE_FIELDS = new Set(["kind", "watchlistIds", "symbols", "filters"]);
const CLIENT_MUTABLE_UNIVERSE_FILTER_FIELDS = new Set(["preferredTimeframes"]);
const CLIENT_MUTABLE_STYLE_FIELDS = new Set(["dominantStyle", "allowedStyles", "multiStyleEnabled"]);
const CLIENT_MUTABLE_TIMEFRAME_FIELDS = new Set(["preferredTimeframes", "allowedTimeframes"]);
const CLIENT_MUTABLE_STRATEGY_FIELDS = new Set(["allowedStrategyIds", "preferredStrategyIds", "adaptiveAdjustmentsEnabled"]);
const CLIENT_MUTABLE_RISK_FIELDS = new Set([
  "maxPositionUsd",
  "maxOpenPositions",
  "maxDailyLossPct",
  "maxDrawdownPct",
  "cooldownAfterLosses",
  "maxSymbolExposurePct",
  "realExecutionRequiresApproval",
]);
const CLIENT_MUTABLE_EXECUTION_POLICY_FIELDS = new Set([
  "canOpenPositions",
  "suggestionsOnly",
  "requiresHumanApproval",
  "autoExecutionEnabled",
  "realExecutionEnabled",
]);
const CLIENT_MUTABLE_AI_FIELDS = new Set([
  "analystEnabled",
  "adjusterEnabled",
  "supervisorEnabled",
  "unrestrictedModeEnabled",
  "requiresConfirmationFor",
  "isolationScope",
]);
const CLIENT_MUTABLE_OVERLAP_FIELDS = new Set([
  "observationOverlap",
  "signalOverlap",
  "executionOverlap",
  "arbitrationMode",
  "priority",
  "exclusiveUniverse",
]);
const CLIENT_MUTABLE_MEMORY_FIELDS = new Set([
  "familySharingEnabled",
  "globalLearningEnabled",
  "allowPromotionToShared",
  "requiresApprovalForSharedLearning",
  "familyScope",
]);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function pickAllowedObject(source, allowedKeys) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const next = {};
  for (const key of allowedKeys) {
    if (hasOwn(source, key)) {
      next[key] = source[key];
    }
  }
  return next;
}

function mergeNestedSection(existingSection, patchSection) {
  if (!patchSection || typeof patchSection !== "object" || Array.isArray(patchSection)) {
    return existingSection;
  }
  return {
    ...(existingSection || {}),
    ...patchSection,
  };
}

function mergeUniversePolicy(existingPolicy, patchPolicy) {
  if (!patchPolicy || typeof patchPolicy !== "object" || Array.isArray(patchPolicy)) {
    return existingPolicy;
  }

  const nextPolicy = {
    ...(existingPolicy || {}),
    ...patchPolicy,
  };

  nextPolicy.watchlistIds = hasOwn(patchPolicy, "watchlistIds")
    ? patchPolicy.watchlistIds
    : existingPolicy?.watchlistIds;
  nextPolicy.symbols = hasOwn(patchPolicy, "symbols")
    ? patchPolicy.symbols
    : existingPolicy?.symbols;
  nextPolicy.filters = hasOwn(patchPolicy, "filters")
    ? mergeNestedSection(existingPolicy?.filters || {}, patchPolicy.filters || {})
    : existingPolicy?.filters;

  return nextPolicy;
}

function mergeTimeframePolicy(existingPolicy, patchPolicy) {
  if (!patchPolicy || typeof patchPolicy !== "object" || Array.isArray(patchPolicy)) {
    return existingPolicy;
  }

  const nextPolicy = {
    ...(existingPolicy || {}),
    ...patchPolicy,
  };

  nextPolicy.preferredTimeframes = hasOwn(patchPolicy, "preferredTimeframes")
    ? patchPolicy.preferredTimeframes
    : existingPolicy?.preferredTimeframes;
  nextPolicy.allowedTimeframes = hasOwn(patchPolicy, "allowedTimeframes")
    ? patchPolicy.allowedTimeframes
    : existingPolicy?.allowedTimeframes;

  return nextPolicy;
}

function normalizeTagList(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

function assertMutableBotPayload(body, mode = "update") {
  const normalizedBody = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const invalidKeys = Object.keys(normalizedBody).filter((key) => !CLIENT_MUTABLE_BOT_FIELDS.has(key));
  if (!invalidKeys.length) return;
  const label = mode === "create" ? "crear" : "actualizar";
  throw new Error(`El payload para ${label} el bot contiene campos no editables desde cliente: ${invalidKeys.join(", ")}.`);
}

function sanitizeMutableBotPayload(body, mode = "update") {
  assertMutableBotPayload(body, mode);
  const normalizedBody = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const nextPayload = {};

  if (hasOwn(normalizedBody, "name")) nextPayload.name = String(normalizedBody.name || "");
  if (hasOwn(normalizedBody, "botType")) nextPayload.botType = normalizedBody.botType;
  if (hasOwn(normalizedBody, "executionAccount")) {
    nextPayload.executionAccount = normalizedBody.executionAccount == null
      ? null
      : pickAllowedObject(normalizedBody.executionAccount, CLIENT_MUTABLE_EXECUTION_ACCOUNT_FIELDS);
  }
  if (hasOwn(normalizedBody, "description")) nextPayload.description = String(normalizedBody.description || "");
  if (hasOwn(normalizedBody, "identity")) nextPayload.identity = pickAllowedObject(normalizedBody.identity, CLIENT_MUTABLE_IDENTITY_FIELDS) || {};
  if (hasOwn(normalizedBody, "status")) nextPayload.status = normalizedBody.status;
  if (hasOwn(normalizedBody, "executionEnvironment")) nextPayload.executionEnvironment = normalizedBody.executionEnvironment;
  if (hasOwn(normalizedBody, "automationMode")) nextPayload.automationMode = normalizedBody.automationMode;
  if (hasOwn(normalizedBody, "capital")) nextPayload.capital = pickAllowedObject(normalizedBody.capital, CLIENT_MUTABLE_CAPITAL_FIELDS) || {};
  if (hasOwn(normalizedBody, "workspaceSettings")) nextPayload.workspaceSettings = pickAllowedObject(normalizedBody.workspaceSettings, CLIENT_MUTABLE_WORKSPACE_FIELDS) || {};
  if (hasOwn(normalizedBody, "generalSettings")) nextPayload.generalSettings = pickAllowedObject(normalizedBody.generalSettings, CLIENT_MUTABLE_GENERAL_SETTINGS_FIELDS) || {};
  if (hasOwn(normalizedBody, "notificationSettings")) nextPayload.notificationSettings = pickAllowedObject(normalizedBody.notificationSettings, CLIENT_MUTABLE_NOTIFICATION_FIELDS) || {};
  if (hasOwn(normalizedBody, "universePolicy")) {
    const universePolicy = pickAllowedObject(normalizedBody.universePolicy, CLIENT_MUTABLE_UNIVERSE_FIELDS) || {};
    if (hasOwn(universePolicy, "filters")) {
      universePolicy.filters = pickAllowedObject(universePolicy.filters, CLIENT_MUTABLE_UNIVERSE_FILTER_FIELDS) || {};
    }
    nextPayload.universePolicy = universePolicy;
  }
  if (hasOwn(normalizedBody, "stylePolicy")) nextPayload.stylePolicy = pickAllowedObject(normalizedBody.stylePolicy, CLIENT_MUTABLE_STYLE_FIELDS) || {};
  if (hasOwn(normalizedBody, "timeframePolicy")) nextPayload.timeframePolicy = pickAllowedObject(normalizedBody.timeframePolicy, CLIENT_MUTABLE_TIMEFRAME_FIELDS) || {};
  if (hasOwn(normalizedBody, "strategyPolicy")) nextPayload.strategyPolicy = pickAllowedObject(normalizedBody.strategyPolicy, CLIENT_MUTABLE_STRATEGY_FIELDS) || {};
  if (hasOwn(normalizedBody, "riskPolicy")) nextPayload.riskPolicy = pickAllowedObject(normalizedBody.riskPolicy, CLIENT_MUTABLE_RISK_FIELDS) || {};
  if (hasOwn(normalizedBody, "executionPolicy")) nextPayload.executionPolicy = pickAllowedObject(normalizedBody.executionPolicy, CLIENT_MUTABLE_EXECUTION_POLICY_FIELDS) || {};
  if (hasOwn(normalizedBody, "aiPolicy")) nextPayload.aiPolicy = pickAllowedObject(normalizedBody.aiPolicy, CLIENT_MUTABLE_AI_FIELDS) || {};
  if (hasOwn(normalizedBody, "overlapPolicy")) nextPayload.overlapPolicy = pickAllowedObject(normalizedBody.overlapPolicy, CLIENT_MUTABLE_OVERLAP_FIELDS) || {};
  if (hasOwn(normalizedBody, "memoryPolicy")) nextPayload.memoryPolicy = pickAllowedObject(normalizedBody.memoryPolicy, CLIENT_MUTABLE_MEMORY_FIELDS) || {};
  if (hasOwn(normalizedBody, "tags")) nextPayload.tags = normalizeTagList(normalizedBody.tags);
  if (hasOwn(normalizedBody, "priority")) nextPayload.priority = normalizedBody.priority;

  return nextPayload;
}

function normalizePair(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeTimeframe(value) {
  const normalized = String(value || "").trim();
  return VALID_TIMEFRAMES.has(normalized) ? normalized : "";
}

function toFiniteNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function uniquePairs(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizePair).filter(Boolean))];
}

function uniqueTimeframes(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeTimeframe).filter(Boolean))];
}

function normalizeAutomationMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_AUTOMATION_MODES.has(normalized) ? normalized : "observe";
}

function normalizeExecutionEnvironment(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_EXECUTION_ENVIRONMENTS.has(normalized) ? normalized : "paper";
}

function syncExecutionPolicyForMode(bot) {
  const mode = normalizeAutomationMode(bot.automationMode);
  const environment = normalizeExecutionEnvironment(bot.executionEnvironment);
  const nextExecutionPolicy = {
    ...(bot.executionPolicy || {}),
  };

  if (mode === "auto") {
    nextExecutionPolicy.autoExecutionEnabled = true;
    nextExecutionPolicy.suggestionsOnly = false;
    nextExecutionPolicy.requiresHumanApproval = false;
    nextExecutionPolicy.canOpenPositions = true;
  } else if (mode === "assist") {
    nextExecutionPolicy.autoExecutionEnabled = false;
    nextExecutionPolicy.suggestionsOnly = false;
    nextExecutionPolicy.requiresHumanApproval = true;
    nextExecutionPolicy.canOpenPositions = true;
  } else {
    nextExecutionPolicy.autoExecutionEnabled = false;
    nextExecutionPolicy.suggestionsOnly = true;
    nextExecutionPolicy.requiresHumanApproval = true;
    nextExecutionPolicy.canOpenPositions = false;
  }

  if (environment !== "real") {
    nextExecutionPolicy.realExecutionEnabled = false;
  }

  return {
    automationMode: mode,
    executionEnvironment: environment,
    executionPolicy: nextExecutionPolicy,
  };
}

function applyBotGuardrails(bot) {
  const nextBot = {
    ...bot,
    automationMode: normalizeAutomationMode(bot.automationMode),
    executionEnvironment: normalizeExecutionEnvironment(bot.executionEnvironment),
    capital: {
      ...bot.capital,
      allocatedUsd: Math.max(0, toFiniteNumber(bot.capital?.allocatedUsd, 0)),
      availableUsd: Math.max(0, toFiniteNumber(bot.capital?.availableUsd, 0)),
    },
    riskPolicy: {
      ...bot.riskPolicy,
      maxPositionUsd: Math.max(0, toFiniteNumber(bot.riskPolicy?.maxPositionUsd, 0)),
      maxOpenPositions: Math.max(1, Math.floor(toFiniteNumber(bot.riskPolicy?.maxOpenPositions, 1))),
      maxDailyLossPct: Math.max(0, toFiniteNumber(bot.riskPolicy?.maxDailyLossPct, 0)),
      maxDrawdownPct: Math.max(0, toFiniteNumber(bot.riskPolicy?.maxDrawdownPct, 0)),
      cooldownAfterLosses: Math.max(0, Math.floor(toFiniteNumber(bot.riskPolicy?.cooldownAfterLosses, 0))),
      maxSymbolExposurePct: Math.max(0, Math.min(100, toFiniteNumber(bot.riskPolicy?.maxSymbolExposurePct, 0))),
    },
    universePolicy: {
      ...bot.universePolicy,
      kind: VALID_UNIVERSE_KINDS.has(String(bot.universePolicy?.kind || "").trim()) ? String(bot.universePolicy.kind).trim() : "watchlist",
      symbols: uniquePairs(bot.universePolicy?.symbols || []),
      watchlistIds: Array.isArray(bot.universePolicy?.watchlistIds)
        ? bot.universePolicy.watchlistIds.map((value) => String(value || "").trim()).filter(Boolean)
        : [],
      filters: {
        ...(bot.universePolicy?.filters || {}),
        preferredTimeframes: uniqueTimeframes(bot.universePolicy?.filters?.preferredTimeframes || []),
      },
    },
    timeframePolicy: {
      ...bot.timeframePolicy,
      preferredTimeframes: uniqueTimeframes(bot.timeframePolicy?.preferredTimeframes || []),
      allowedTimeframes: uniqueTimeframes(bot.timeframePolicy?.allowedTimeframes || []),
    },
  };

  if (!nextBot.timeframePolicy.allowedTimeframes.length) {
    nextBot.timeframePolicy.allowedTimeframes = ["1h"];
  }

  if (!nextBot.timeframePolicy.preferredTimeframes.length) {
    nextBot.timeframePolicy.preferredTimeframes = [nextBot.timeframePolicy.allowedTimeframes[0]];
  }

  if (nextBot.timeframePolicy.preferredTimeframes.some((timeframe) => !nextBot.timeframePolicy.allowedTimeframes.includes(timeframe))) {
    nextBot.timeframePolicy.preferredTimeframes = nextBot.timeframePolicy.preferredTimeframes.filter((timeframe) => nextBot.timeframePolicy.allowedTimeframes.includes(timeframe));
    if (!nextBot.timeframePolicy.preferredTimeframes.length) {
      nextBot.timeframePolicy.preferredTimeframes = [nextBot.timeframePolicy.allowedTimeframes[0]];
    }
  }

  if (!nextBot.universePolicy.filters.preferredTimeframes.length) {
    nextBot.universePolicy.filters.preferredTimeframes = [...nextBot.timeframePolicy.preferredTimeframes];
  } else {
    nextBot.universePolicy.filters.preferredTimeframes = nextBot.universePolicy.filters.preferredTimeframes
      .filter((timeframe) => nextBot.timeframePolicy.allowedTimeframes.includes(timeframe));
    if (!nextBot.universePolicy.filters.preferredTimeframes.length) {
      nextBot.universePolicy.filters.preferredTimeframes = [...nextBot.timeframePolicy.preferredTimeframes];
    }
  }

  if (nextBot.universePolicy.kind === "custom-list" && !nextBot.universePolicy.symbols.length) {
    throw new Error("El bot necesita al menos un par activo cuando trabaja con lista propia.");
  }

  const primaryPair = normalizePair(nextBot.workspaceSettings?.primaryPair || nextBot.universePolicy.symbols?.[0] || "");
  if (nextBot.universePolicy.kind === "custom-list" && primaryPair && !nextBot.universePolicy.symbols.includes(primaryPair)) {
    throw new Error("El par principal del bot debe existir dentro de su lista activa de monedas.");
  }

  nextBot.workspaceSettings = {
    ...nextBot.workspaceSettings,
    primaryPair: primaryPair || nextBot.universePolicy.symbols[0] || "BTC/USDT",
  };
  nextBot.generalSettings = {
    ...nextBot.generalSettings,
    defaultTradingPair: nextBot.workspaceSettings.primaryPair,
  };

  if (nextBot.riskPolicy.maxPositionUsd > nextBot.capital.allocatedUsd) {
    throw new Error("Max Position Size no puede superar el capital asignado al bot.");
  }

  nextBot.capital.availableUsd = Math.min(nextBot.capital.availableUsd, nextBot.capital.allocatedUsd);
  Object.assign(nextBot, syncExecutionPolicyForMode(nextBot));

  return nextBot;
}

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

function normalizeBotType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SUPPORTED_BOT_TYPES.has(normalized) ? normalized : "signal-bot";
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
    botType: normalizeBotType(overrides.botType),
    executionAccount: overrides.executionAccount && typeof overrides.executionAccount === "object"
      ? {
          id: String(overrides.executionAccount.id || "").trim(),
          label: String(overrides.executionAccount.label || "").trim(),
          provider: String(overrides.executionAccount.provider || "").trim(),
          environment: String(overrides.executionAccount.environment || "").trim(),
        }
      : null,
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
    tags: Array.isArray(overrides.tags) ? normalizeTagList(overrides.tags) : ["system", "signals"],
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
    botType: source.botType,
    executionAccount: source.executionAccount,
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

function sanitizeStoredBotForHydration(bot) {
  const nextBot = normalizeBotPayload(bot);
  const allocatedUsd = Math.max(0, toFiniteNumber(nextBot.capital?.allocatedUsd, 0));
  const primaryPair = normalizePair(nextBot.workspaceSettings?.primaryPair || nextBot.generalSettings?.defaultTradingPair || nextBot.universePolicy?.symbols?.[0] || "");
  const normalizedSymbols = uniquePairs(nextBot.universePolicy?.symbols || []);

  if (nextBot.universePolicy?.kind === "custom-list" && !normalizedSymbols.length) {
    if (primaryPair) {
      nextBot.universePolicy = {
        ...nextBot.universePolicy,
        symbols: [primaryPair],
      };
    } else {
      nextBot.universePolicy = {
        ...nextBot.universePolicy,
        kind: "watchlist",
      };
    }
  } else if (nextBot.universePolicy?.kind === "custom-list" && primaryPair && !normalizedSymbols.includes(primaryPair)) {
    nextBot.universePolicy = {
      ...nextBot.universePolicy,
      symbols: [...normalizedSymbols, primaryPair],
    };
  }

  nextBot.riskPolicy = {
    ...nextBot.riskPolicy,
    maxPositionUsd: Math.min(
      Math.max(0, toFiniteNumber(nextBot.riskPolicy?.maxPositionUsd, 0)),
      allocatedUsd,
    ),
  };

  nextBot.capital = {
    ...nextBot.capital,
    allocatedUsd,
    availableUsd: Math.min(
      Math.max(0, toFiniteNumber(nextBot.capital?.availableUsd, allocatedUsd)),
      allocatedUsd,
    ),
  };

  return nextBot;
}

function rowToBot(row) {
  const source = sanitizeStoredBotForHydration({
    ...(row?.bot_payload && typeof row.bot_payload === "object" ? row.bot_payload : {}),
    id: row?.bot_id,
    slug: row?.slug,
    name: row?.name,
    status: row?.status,
    createdAt: row?.created_at,
    updatedAt: row?.updated_at,
  });

  return applyBotGuardrails(source);
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

async function listBotIdsForUser(username) {
  const rows = await listBotRowsForUser(username);
  return rows
    .map((row) => String(row?.bot_id || row?.id || "").trim())
    .filter(Boolean);
}

function doesRowNeedContractRepair(username, row) {
  const hydratedBot = rowToBot(row);
  const normalizedRow = botToRow(username, hydratedBot);
  return (
    String(row?.status || "") !== String(normalizedRow.status || "")
    || String(row?.slug || "") !== String(normalizedRow.slug || "")
    || String(row?.name || "") !== String(normalizedRow.name || "")
    || JSON.stringify(row?.bot_payload || {}) !== JSON.stringify(normalizedRow.bot_payload || {})
  );
}

async function repairStoredBotContractsForUser(username, rows) {
  const normalizedUsername = String(username || "").trim();
  if (!normalizedUsername || !Array.isArray(rows) || !rows.length) return rows || [];

  const nextRows = [...rows];
  for (let index = 0; index < nextRows.length; index += 1) {
    const row = nextRows[index];
    if (!doesRowNeedContractRepair(normalizedUsername, row)) continue;

    const hydratedBot = rowToBot(row);
    const normalizedRow = botToRow(normalizedUsername, hydratedBot);
    const updateParams = new URLSearchParams({
      username: `eq.${normalizedUsername}`,
      bot_id: `eq.${String(row?.bot_id || normalizedRow.bot_id || "")}`,
    });
    const patchedRows = await supabaseRequest(`${BOTS_TABLE}?${updateParams.toString()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: normalizedRow,
    }).catch(() => null);

    nextRows[index] = patchedRows?.[0] || normalizedRow;
  }

  return nextRows;
}

async function listBots(req) {
  const session = requireSession(req);
  const rows = await repairStoredBotContractsForUser(
    session.username,
    await listBotRowsForUser(session.username),
  );
  return {
    bots: rows.map(rowToBot),
    lastHydratedAt: nowIso(),
  };
}

async function createBot(req) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  const clientPayload = sanitizeMutableBotPayload(body, "create");
  const rawName = String(clientPayload?.name || "").trim();
  if (!rawName) {
    throw new Error("El nombre del bot es obligatorio.");
  }
  const sourceName = rawName;
  const baseSlug = slugify(sourceName || "signal-bot");
  const uniqueId = `${baseSlug}-${Date.now()}`;
  const createdAt = nowIso();
  const bot = applyBotGuardrails(normalizeBotPayload({
    ...clientPayload,
    id: uniqueId,
    slug: baseSlug,
    name: sourceName,
    botType: normalizeBotType(clientPayload?.botType),
    status: clientPayload?.status || "draft",
    executionEnvironment: clientPayload?.executionEnvironment || clientPayload?.executionAccount?.environment || "paper",
    automationMode: clientPayload?.automationMode || "observe",
    primaryPair: clientPayload?.workspaceSettings?.primaryPair || clientPayload?.generalSettings?.defaultTradingPair || clientPayload?.universePolicy?.symbols?.[0] || "BTC/USDT",
    allocatedUsd: clientPayload?.capital?.allocatedUsd ?? 0,
    availableUsd: clientPayload?.capital?.availableUsd ?? clientPayload?.capital?.allocatedUsd ?? 0,
    description: clientPayload?.description,
    tags: hasOwn(clientPayload, "tags") ? clientPayload.tags : undefined,
    createdAt,
    updatedAt: createdAt,
  }));

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
  const clientPatch = sanitizeMutableBotPayload(body, "update");
  if (hasOwn(clientPatch, "name") && !String(clientPatch?.name || "").trim()) {
    throw new Error("El nombre del bot es obligatorio.");
  }
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
  const nextBot = applyBotGuardrails(normalizeBotPayload({
    ...existingBot,
    ...clientPatch,
    botType: hasOwn(clientPatch, "botType")
      ? normalizeBotType(clientPatch?.botType)
      : existingBot.botType,
    identity: hasOwn(clientPatch, "identity") ? mergeNestedSection(existingBot.identity, clientPatch.identity) : existingBot.identity,
    capital: hasOwn(clientPatch, "capital") ? mergeNestedSection(existingBot.capital, clientPatch.capital) : existingBot.capital,
    workspaceSettings: hasOwn(clientPatch, "workspaceSettings")
      ? mergeNestedSection(existingBot.workspaceSettings, clientPatch.workspaceSettings)
      : existingBot.workspaceSettings,
    generalSettings: hasOwn(clientPatch, "generalSettings")
      ? mergeNestedSection(existingBot.generalSettings, clientPatch.generalSettings)
      : existingBot.generalSettings,
    notificationSettings: hasOwn(clientPatch, "notificationSettings")
      ? mergeNestedSection(existingBot.notificationSettings, clientPatch.notificationSettings)
      : existingBot.notificationSettings,
    universePolicy: hasOwn(clientPatch, "universePolicy")
      ? mergeUniversePolicy(existingBot.universePolicy, clientPatch.universePolicy)
      : existingBot.universePolicy,
    stylePolicy: hasOwn(clientPatch, "stylePolicy") ? mergeNestedSection(existingBot.stylePolicy, clientPatch.stylePolicy) : existingBot.stylePolicy,
    timeframePolicy: hasOwn(clientPatch, "timeframePolicy")
      ? mergeTimeframePolicy(existingBot.timeframePolicy, clientPatch.timeframePolicy)
      : existingBot.timeframePolicy,
    riskPolicy: hasOwn(clientPatch, "riskPolicy") ? mergeNestedSection(existingBot.riskPolicy, clientPatch.riskPolicy) : existingBot.riskPolicy,
    strategyPolicy: hasOwn(clientPatch, "strategyPolicy") ? mergeNestedSection(existingBot.strategyPolicy, clientPatch.strategyPolicy) : existingBot.strategyPolicy,
    executionPolicy: hasOwn(clientPatch, "executionPolicy")
      ? mergeNestedSection(existingBot.executionPolicy, clientPatch.executionPolicy)
      : existingBot.executionPolicy,
    aiPolicy: hasOwn(clientPatch, "aiPolicy") ? mergeNestedSection(existingBot.aiPolicy, clientPatch.aiPolicy) : existingBot.aiPolicy,
    overlapPolicy: hasOwn(clientPatch, "overlapPolicy") ? mergeNestedSection(existingBot.overlapPolicy, clientPatch.overlapPolicy) : existingBot.overlapPolicy,
    memoryPolicy: hasOwn(clientPatch, "memoryPolicy") ? mergeNestedSection(existingBot.memoryPolicy, clientPatch.memoryPolicy) : existingBot.memoryPolicy,
    tags: hasOwn(clientPatch, "tags") ? clientPatch.tags : existingBot.tags,
    updatedAt: nowIso(),
  }));

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
  listBotIdsForUser,
  listBots,
  sendJson,
  updateBot,
};

export const __botInternals = {
  assertMutableBotPayload,
  sanitizeMutableBotPayload,
  mergeUniversePolicy,
  mergeTimeframePolicy,
  applyBotGuardrails,
  normalizeBotPayload,
  sanitizeStoredBotForHydration,
  rowToBot,
  doesRowNeedContractRepair,
};
