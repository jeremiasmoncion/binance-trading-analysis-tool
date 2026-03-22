import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_USERS = ["jeremias", "yeudy"];
const PROJECT_ROOT = "/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool";
const STRATEGY_ENGINE_PATH = path.join(PROJECT_ROOT, "api/_lib/strategyEngine.js");
const EXECUTION_ENGINE_PATH = path.join(PROJECT_ROOT, "api/_lib/executionEngine.js");

function parseArgs(argv) {
  const args = new Map();
  for (const entry of argv) {
    if (!entry.startsWith("--")) continue;
    const [key, ...rest] = entry.split("=");
    args.set(key, rest.length ? rest.join("=") : "true");
  }
  return args;
}

function loadEnvFile(envFile) {
  if (!envFile || !fs.existsSync(envFile)) return;
  const raw = fs.readFileSync(envFile, "utf8");
  for (const line of raw.split(/\n+/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (value.startsWith("\"")) {
      try {
        value = JSON.parse(value);
      } catch {
        // Keep raw string if JSON parsing fails.
      }
    }
    process.env[key] = value;
  }
}

async function supabaseFetch(pathname) {
  const baseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios para system-audit.");
  }

  const response = await fetch(`${baseUrl}/rest/v1/${pathname}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });
  const text = await response.text().catch(() => "");
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      payload,
    };
  }
  return {
    ok: true,
    status: response.status,
    payload,
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function bucketBy(items, getKey) {
  return items.reduce((accumulator, item) => {
    const key = String(getKey(item) || "unknown");
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function chunkArray(items, size = 100) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function hasExplicitExecutionSide(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "BUY" || normalized === "SELL";
}

function orderRequiresExplicitSide(order) {
  const lifecycle = String(order?.lifecycle_status || order?.status || "").trim().toLowerCase();
  return lifecycle !== "blocked";
}

function computeBotAutomationConsistency(bots) {
  const normalizedBots = asArray(bots).map((bot) => {
    const payload = bot?.bot_payload && typeof bot.bot_payload === "object" ? bot.bot_payload : bot;
    const executionPolicy = payload?.executionPolicy && typeof payload.executionPolicy === "object" ? payload.executionPolicy : {};
    return {
      botId: String(bot?.bot_id || payload?.id || ""),
      name: String(bot?.name || payload?.name || ""),
      status: String(bot?.status || payload?.status || "").trim().toLowerCase(),
      automationMode: String(payload?.automationMode || "").trim().toLowerCase(),
      executionEnvironment: String(payload?.executionEnvironment || "").trim().toLowerCase(),
      executionPolicy,
    };
  });

  const inconsistentBots = normalizedBots
    .map((bot) => {
      const reasons = [];
      if (bot.automationMode === "auto") {
        if (!bot.executionPolicy.autoExecutionEnabled) reasons.push("autoExecutionEnabled should be true");
        if (bot.executionPolicy.suggestionsOnly) reasons.push("suggestionsOnly should be false");
        if (bot.executionPolicy.requiresHumanApproval) reasons.push("requiresHumanApproval should be false");
        if (!bot.executionPolicy.canOpenPositions) reasons.push("canOpenPositions should be true");
      } else if (bot.automationMode === "assist") {
        if (bot.executionPolicy.autoExecutionEnabled) reasons.push("autoExecutionEnabled should be false");
        if (bot.executionPolicy.suggestionsOnly) reasons.push("suggestionsOnly should be false");
        if (!bot.executionPolicy.requiresHumanApproval) reasons.push("requiresHumanApproval should be true");
        if (!bot.executionPolicy.canOpenPositions) reasons.push("canOpenPositions should be true");
      } else if (bot.automationMode === "observe") {
        if (bot.executionPolicy.autoExecutionEnabled) reasons.push("autoExecutionEnabled should be false");
        if (!bot.executionPolicy.suggestionsOnly) reasons.push("suggestionsOnly should be true");
        if (!bot.executionPolicy.requiresHumanApproval) reasons.push("requiresHumanApproval should be true");
        if (bot.executionPolicy.canOpenPositions) reasons.push("canOpenPositions should be false");
      }

      if (bot.executionEnvironment !== "real" && bot.executionPolicy.realExecutionEnabled) {
        reasons.push("realExecutionEnabled should be false outside real environment");
      }

      return reasons.length ? { ...bot, reasons } : null;
    })
    .filter(Boolean);

  return {
    totalBots: normalizedBots.length,
    activeBots: normalizedBots.filter((bot) => bot.status === "active").length,
    autoBots: normalizedBots.filter((bot) => bot.automationMode === "auto").length,
    inconsistentBots,
  };
}

async function fetchSignalsByIdsForUser(username, ids) {
  const normalizedIds = [...new Set(
    (Array.isArray(ids) ? ids : [])
      .map((value) => Number(value || 0))
      .filter((value) => Number.isFinite(value) && value > 0),
  )];
  if (!normalizedIds.length) return [];

  const rows = [];
  for (const chunk of chunkArray(normalizedIds, 100)) {
    const response = await supabaseFetch(
      `signal_snapshots?select=id,coin,timeframe,outcome_status,execution_order_id,execution_status&username=eq.${username}&id=in.(${chunk.join(",")})&limit=${chunk.length}`,
    );
    if (response.ok) rows.push(...asArray(response.payload));
  }
  return rows;
}

function computeSignalOrderConsistency(signals, orders, referencedSignals = []) {
  const totalSignals = signals.length;
  const totalOrders = orders.length;
  const linkedSignals = signals.filter((signal) => Number(signal.execution_order_id || 0) > 0).length;
  const closedSignals = signals.filter((signal) => String(signal.outcome_status || "").trim() !== "pending").length;
  const closedOrders = orders.filter((order) => {
    const lifecycle = String(order.lifecycle_status || "").trim().toLowerCase();
    return lifecycle.startsWith("closed_") || String(order.signal_outcome_status || "").trim();
  }).length;
  const openOrders = orders.filter((order) => {
    const lifecycle = String(order.lifecycle_status || "").trim().toLowerCase();
    return ["created", "placed", "filled", "filled_unprotected", "protected", "open"].includes(lifecycle);
  }).length;
  const directionalOrders = orders.filter((order) => orderRequiresExplicitSide(order));
  const missingSide = directionalOrders.filter((order) => !hasExplicitExecutionSide(order.side)).length;
  const expectedOrderIdsBySignalId = orders.reduce((accumulator, order) => {
    const signalId = Number(order.signal_id || 0);
    const orderId = Number(order.id || 0);
    if (!signalId || !orderId) return accumulator;
    const current = accumulator.get(signalId) || new Set();
    current.add(orderId);
    accumulator.set(signalId, current);
    return accumulator;
  }, new Map());
  const linkedReferencedSignals = referencedSignals.filter((signal) => Number(signal.execution_order_id || 0) > 0).length;
  const exactReferencedLinks = referencedSignals.filter((signal) => {
    const signalId = Number(signal.id || 0);
    const executionOrderId = Number(signal.execution_order_id || 0);
    if (!signalId || !executionOrderId) return false;
    return expectedOrderIdsBySignalId.get(signalId)?.has(executionOrderId) === true;
  }).length;

  return {
    totalSignals,
    totalOrders,
    linkedSignals,
    closedSignals,
    closedOrders,
    openOrders,
    linkedSignalPct: totalSignals ? Number(((linkedSignals / totalSignals) * 100).toFixed(2)) : 0,
    closedSignalPct: totalSignals ? Number(((closedSignals / totalSignals) * 100).toFixed(2)) : 0,
    directionalOrders: directionalOrders.length,
    missingSidePct: directionalOrders.length ? Number(((missingSide / directionalOrders.length) * 100).toFixed(2)) : 0,
    referencedSignals: referencedSignals.length,
    linkedReferencedSignals,
    exactReferencedLinks,
    linkedReferencedSignalPct: referencedSignals.length
      ? Number(((linkedReferencedSignals / referencedSignals.length) * 100).toFixed(2))
      : 0,
    exactReferencedLinkPct: referencedSignals.length
      ? Number(((exactReferencedLinks / referencedSignals.length) * 100).toFixed(2))
      : 0,
  };
}

function summarizeBacktest(lab) {
  const summary = lab?.report?.summary || null;
  const invariants = Array.isArray(lab?.report?.invariants) ? lab.report.invariants : [];
  return {
    summary,
    invariants,
    replayWindows: Array.isArray(lab?.report?.replayWindows) ? lab.report.replayWindows : [],
    latestRun: Array.isArray(lab?.runs) ? lab.runs[0] || null : null,
    queue: lab?.queue || { pending: 0, running: 0 },
  };
}

function buildFindings(reportByUser, globalData) {
  const findings = [];

  for (const [username, report] of Object.entries(reportByUser)) {
    const linkage = report.consistency.referencedSignals > 0
      ? report.consistency.exactReferencedLinkPct
      : report.consistency.linkedSignalPct;
    if (linkage < 30) {
      findings.push({
        severity: "high",
        scope: username,
        title: "Signal-to-order linkage is weak",
        detail: report.consistency.referencedSignals > 0
          ? `${username} only keeps ${report.consistency.exactReferencedLinks}/${report.consistency.referencedSignals} exact signal-to-order links across execution-referenced signals (${linkage}%).`
          : `${username} only links ${report.consistency.linkedSignals}/${report.consistency.totalSignals} signals to execution orders (${linkage}%).`,
      });
    }

    if (report.consistency.missingSidePct > 5) {
      findings.push({
        severity: "medium",
        scope: username,
        title: "Execution orders still miss side metadata",
        detail: `${username} has ${report.consistency.missingSidePct}% of trade-relevant execution orders without explicit BUY/SELL side.`,
      });
    }

    const summary = report.backtest.summary;
    if (summary && Number(summary.failedInvariants || 0) > 0) {
      findings.push({
        severity: "high",
        scope: username,
        title: "Backtesting invariants are failing",
        detail: `${username} backtesting summary reports ${summary.failedInvariants} failed invariants.`,
      });
    }

    if (summary && Number(summary.warnedInvariants || 0) > 0 && report.backtest.invariants.length === 0) {
      findings.push({
        severity: "medium",
        scope: username,
        title: "Validation lab payload is inconsistent",
        detail: `${username} shows warned invariants in summary but returned no invariant detail rows.`,
      });
    }

    if (report.botAutomation.inconsistentBots.length > 0) {
      findings.push({
        severity: "high",
        scope: username,
        title: "Bot automation contracts drifted from runtime policy",
        detail: `${username} has ${report.botAutomation.inconsistentBots.length} bots with inconsistent automationMode/executionPolicy flags.`,
      });
    }
  }

  if (globalData.crossUser.botIdOverlap.length > 0) {
    findings.push({
      severity: "high",
      scope: "global",
      title: "Bot IDs overlap across users",
      detail: `Cross-user bot ID overlap detected: ${globalData.crossUser.botIdOverlap.join(", ")}`,
    });
  }

  return findings;
}

async function auditUser(username, strategyEngine, executionEngine, options) {
  if (options.runBacktest) {
    await strategyEngine.runStrategyBacktestForUser(username, {
      label: options.label,
      triggerSource: options.triggerSource,
    });
  }

  if (options.processQueue) {
    await strategyEngine.processQueuedStrategyBacktestsForUser(username, {
      limit: 1,
      triggerSource: `${options.triggerSource}-process`,
    });
  }

  const executionReconciliation = executionEngine?.reconcileExecutionRecordsForUser
    ? await executionEngine.reconcileExecutionRecordsForUser(username, {
      signalsLimit: 500,
      ordersLimit: 500,
    }).catch(() => null)
    : null;

  const [lab, botsRes, decisionsRes, signalsRes, ordersRes, watchlistRes] = await Promise.all([
    strategyEngine.getStrategyValidationLabForUser(username),
    supabaseFetch(`bot_profiles?select=bot_id,status,name,bot_payload&username=eq.${username}&order=created_at.asc`),
    supabaseFetch(`bot_decisions?select=decision_id,status,action,bot_id&username=eq.${username}&order=created_at.desc&limit=500`),
    supabaseFetch(`signal_snapshots?select=id,coin,timeframe,outcome_status,execution_order_id,execution_status&username=eq.${username}&order=created_at.desc&limit=500`),
    supabaseFetch(`execution_orders?select=id,signal_id,coin,timeframe,lifecycle_status,signal_outcome_status,side&username=eq.${username}&order=created_at.desc&limit=500`),
    supabaseFetch(`watchlist_items?select=id,list_name,coin&username=eq.${username}&order=created_at.asc&limit=500`),
  ]);

  const bots = asArray(botsRes.payload);
  const decisions = asArray(decisionsRes.payload);
  const signals = asArray(signalsRes.payload);
  const orders = asArray(ordersRes.payload);
  const watchlist = asArray(watchlistRes.payload);
  const referencedSignals = await fetchSignalsByIdsForUser(
    username,
    orders.map((order) => order.signal_id),
  );

  return {
    username,
    backtest: summarizeBacktest(lab),
    bots: {
      total: bots.length,
      ids: bots.map((bot) => String(bot.bot_id || "")),
      byStatus: bucketBy(bots, (bot) => bot.status),
    },
    botAutomation: computeBotAutomationConsistency(bots),
    decisions: {
      total: decisions.length,
      byStatus: bucketBy(decisions, (decision) => decision.status),
      byAction: bucketBy(decisions, (decision) => decision.action),
    },
    watchlist: {
      total: watchlist.length,
      lists: [...new Set(watchlist.map((item) => String(item.list_name || "")).filter(Boolean))],
      coins: [...new Set(watchlist.map((item) => String(item.coin || "")).filter(Boolean))],
    },
    executionReconciliation,
    consistency: computeSignalOrderConsistency(signals, orders, referencedSignals),
    rawChecks: {
      botsQueryOk: botsRes.ok,
      decisionsQueryOk: decisionsRes.ok,
      signalsQueryOk: signalsRes.ok,
      ordersQueryOk: ordersRes.ok,
      watchlistQueryOk: watchlistRes.ok,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadEnvFile(String(args.get("--env-file") || "").trim());

  const users = String(args.get("--users") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const auditUsers = users.length ? users : DEFAULT_USERS;
  const runBacktest = String(args.get("--run-backtest") || "").trim() === "true";
  const processQueue = String(args.get("--process-queue") || "").trim() !== "false";
  const label = String(args.get("--label") || "system-audit");
  const triggerSource = String(args.get("--trigger-source") || "system-audit");

  const strategyEngine = await import(STRATEGY_ENGINE_PATH);
  const executionEngine = await import(EXECUTION_ENGINE_PATH);
  const reports = {};

  for (const username of auditUsers) {
    reports[username] = await auditUser(username, strategyEngine, executionEngine, {
      runBacktest,
      processQueue,
      label,
      triggerSource,
    });
  }

  const botIdsByUser = Object.fromEntries(
    Object.entries(reports).map(([username, report]) => [username, new Set(report.bots.ids)]),
  );
  const firstUserIds = auditUsers.length ? botIdsByUser[auditUsers[0]] : new Set();
  const botIdOverlap = auditUsers.slice(1).flatMap((username) => {
    const overlaps = [];
    for (const botId of botIdsByUser[username] || []) {
      if (firstUserIds.has(botId)) overlaps.push(botId);
    }
    return overlaps;
  });

  const globalData = {
    checkedAt: new Date().toISOString(),
    users: auditUsers,
    crossUser: {
      botIdOverlap,
    },
  };

  const findings = buildFindings(reports, globalData);

  const output = {
    global: globalData,
    findings,
    reports,
  };

  console.log(JSON.stringify(output, null, 2));
}

const isCliEntry = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isCliEntry) {
  void main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : "system-audit failed",
    }, null, 2));
    process.exitCode = 1;
  });
}

export {
  computeBotAutomationConsistency,
  computeSignalOrderConsistency,
  hasExplicitExecutionSide,
  orderRequiresExplicitSide,
};
