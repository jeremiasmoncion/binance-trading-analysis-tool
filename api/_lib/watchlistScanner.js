import { getSession, sendJson } from "./auth.js";
import { executeSignalTradeForUser, getExecutionProfileForUser } from "./executionEngine.js";
import { buildMarketSnapshot, fetchTickerPrice, getScannableTimeframes, getTimeframeScanInterval } from "./marketRuntime.js";
import { createSignalSnapshotForUser, evaluatePendingSignalsForUser, listSignalSnapshotsForUser } from "./signals.js";
import { applySystemStrategyDecision, getSystemStrategyDecisionState } from "./strategyEngine.js";
import { listWatchlistScanTargets } from "./watchlist.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WATCHLIST_SCAN_STATE_TABLE = process.env.SUPABASE_WATCHLIST_SCAN_STATE_TABLE || "watchlist_scan_state";
const WATCHLIST_SCAN_RUNS_TABLE = process.env.SUPABASE_WATCHLIST_SCAN_RUNS_TABLE || "watchlist_scan_runs";
const SCANNER_SYSTEM_COIN = "__scanner__";
const SCANNER_SYSTEM_TIMEFRAME = "system";
const DEFAULT_AUTO_EXECUTION_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_AUTO_EXECUTION_ATTEMPTS_PER_SCAN = 2;

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase no está configurado para el vigilante del watchlist");
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
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Supabase devolvió una respuesta no JSON en ${path}`);
  }
}

function hasValidSession(req) {
  return Boolean(getSession(req));
}

function canRunAsScheduler(req) {
  const headerToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const secret = String(process.env.CRON_SECRET || process.env.WATCHLIST_SCAN_SECRET || "").trim();
  if (secret && headerToken && headerToken === secret) return true;
  return Boolean(req.headers["x-vercel-cron"]);
}

function isActionableSignal(snapshot) {
  const { primary } = snapshot;
  return primary.signal.label !== "Esperar"
    || (primary.analysis.setupQuality === "Alta" && primary.analysis.alignmentCount >= 4);
}

function getScannerSystemState(scanState) {
  const row = scanState.get(`${SCANNER_SYSTEM_COIN}|${SCANNER_SYSTEM_TIMEFRAME}`);
  return row?.last_summary && typeof row.last_summary === "object" ? row.last_summary : {};
}

function getScannerCooldownUntil(summary) {
  const rawValue = summary?.autoExecutionCooldownUntil;
  const timestamp = rawValue ? new Date(rawValue).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildScannerSystemStateRow(username, previousSummary, nextSummary) {
  return {
    username,
    coin: SCANNER_SYSTEM_COIN,
    timeframe: SCANNER_SYSTEM_TIMEFRAME,
    last_scanned_at: new Date().toISOString(),
    last_strategy_id: null,
    last_strategy_version: null,
    last_signal_created_at: null,
    last_summary: {
      ...(previousSummary && typeof previousSummary === "object" ? previousSummary : {}),
      ...(nextSummary && typeof nextSummary === "object" ? nextSummary : {}),
      updatedAt: new Date().toISOString(),
    },
  };
}

function parseBinanceThrottle(error) {
  const message = String(error?.message || "");
  const normalized = message.toLowerCase();
  if (!normalized.includes("request weight") && !normalized.includes("ip banned")) {
    return null;
  }
  const untilMatch = message.match(/until\s+(\d{10,13})/i);
  const cooldownUntil = untilMatch
    ? new Date(Number(untilMatch[1])).toISOString()
    : new Date(Date.now() + DEFAULT_AUTO_EXECUTION_COOLDOWN_MS).toISOString();
  return {
    cooldownUntil,
    reason: message,
  };
}

async function getScanState(username) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${username}`,
    limit: "500",
  });
  const rows = await supabaseRequest(`${WATCHLIST_SCAN_STATE_TABLE}?${params.toString()}`).catch(() => []);
  return new Map((rows || []).map((row) => [`${row.coin}|${row.timeframe}`, row]));
}

async function upsertScanState(rows) {
  if (!rows.length) return;
  await supabaseRequest(`${WATCHLIST_SCAN_STATE_TABLE}?on_conflict=username,coin,timeframe`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: rows,
  });
}

async function createScanRun(run) {
  await supabaseRequest(WATCHLIST_SCAN_RUNS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: [run],
  });
}

async function listRecentRuns(username = null) {
  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: "10",
  });
  if (username) params.set("username", `eq.${username}`);
  return supabaseRequest(`${WATCHLIST_SCAN_RUNS_TABLE}?${params.toString()}`).catch(() => []);
}

function shouldScanNow(lastScannedAt, timeframe) {
  if (!lastScannedAt) return true;
  const elapsed = Date.now() - new Date(lastScannedAt).getTime();
  return elapsed >= getTimeframeScanInterval(timeframe);
}

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let currentIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const itemIndex = currentIndex;
      currentIndex += 1;
      results[itemIndex] = await worker(items[itemIndex], itemIndex);
    }
  });

  await Promise.all(runners);
  return results;
}

async function scanUserWatchlist(target, scanSource) {
  const scanState = await getScanState(target.username);
  const executionProfile = await getExecutionProfileForUser(target.username).catch(() => null);
  const decisionState = await getSystemStrategyDecisionState(target.username).catch(() => null);
  const pendingSignals = await listSignalSnapshotsForUser(target.username, {
    outcomeStatus: "pending",
    limit: 200,
  }).catch(() => []);
  const coins = Array.from(new Set(target.coins || []));
  const timeframes = getScannableTimeframes();
  const pendingCoins = new Set((pendingSignals || []).map((item) => item.coin).filter(Boolean));
  const previousSystemSummary = getScannerSystemState(scanState);
  let autoExecutionCooldownUntil = getScannerCooldownUntil(previousSystemSummary);
  let autoExecutionCooldownReason = String(previousSystemSummary?.autoExecutionCooldownReason || "");
  const priceMap = {};
  const stateUpdates = [];
  const signalRows = [];
  const errors = [];
  let autoOrdersPlaced = 0;
  let autoOrdersBlocked = 0;
  let autoOrdersSkipped = 0;
  let autoExecutionAttempts = 0;
  let scannedFrames = 0;

  const coinResults = await runWithConcurrency(coins, 4, async (coin) => {
    const nextErrors = [];
    const nextStateUpdates = [];
    const nextSignalRows = [];
    let nextAutoOrdersPlaced = 0;
    let nextAutoOrdersBlocked = 0;
    let nextScannedFrames = 0;
    const nextPriceMap = {};

    const dueTimeframes = timeframes.filter((timeframe) => {
      const stateKey = `${coin}|${timeframe}`;
      const previousState = scanState.get(stateKey);
      return shouldScanNow(previousState?.last_scanned_at, timeframe);
    });

    if (!dueTimeframes.length && !pendingCoins.has(coin)) {
      return {
        priceMap: nextPriceMap,
        stateUpdates: nextStateUpdates,
        signalRows: nextSignalRows,
        autoOrdersPlaced: nextAutoOrdersPlaced,
        autoOrdersBlocked: nextAutoOrdersBlocked,
        scannedFrames: nextScannedFrames,
        errors: nextErrors,
      };
    }

    const candleCache = new Map();
    if (dueTimeframes.length) {
      await Promise.all(
        Array.from(new Set([...getScannableTimeframes(), "5m", "15m", "1h", "4h", "1d"])).map(async (timeframe) => {
          try {
            const snapshot = await buildMarketSnapshot(coin, timeframe, { candleCache });
            candleCache.set(`${coin}|${timeframe}|snapshot`, snapshot);
          } catch (error) {
            nextErrors.push(`${coin} ${timeframe}: ${error.message || "error desconocido"}`);
          }
        }),
      );
    } else if (pendingCoins.has(coin)) {
      const ticker = await fetchTickerPrice(coin).catch(() => null);
      if (ticker?.lastPrice) {
        nextPriceMap[coin] = ticker.lastPrice;
      }
    }

    for (const timeframe of dueTimeframes) {
      const previousState = scanState.get(`${coin}|${timeframe}`);
      try {
        const snapshot = candleCache.get(`${coin}|${timeframe}|snapshot`) || await buildMarketSnapshot(coin, timeframe, { candleCache });
        if (!nextPriceMap[coin] && snapshot?.currentPrice) {
          nextPriceMap[coin] = snapshot.currentPrice;
        }
        const resolvedDecision = applySystemStrategyDecision(snapshot, decisionState, {
          marketScope: "watchlist",
          timeframe,
        });
        nextScannedFrames += 1;
        let createdSignalAt = previousState?.last_signal_created_at || null;

        if (isActionableSignal({
          ...snapshot,
          primary: {
            ...snapshot.primary,
            signal: resolvedDecision.signal,
            analysis: resolvedDecision.analysis,
            strategy: resolvedDecision.strategy,
          },
        })) {
          const createdSignal = await createSignalSnapshotForUser(target.username, {
            coin,
            timeframe,
            signal: resolvedDecision.signal,
            analysis: resolvedDecision.analysis,
            plan: resolvedDecision.plan,
            multiTimeframes: snapshot.multiTimeframes,
            strategy: resolvedDecision.strategy,
            strategyCandidates: resolvedDecision.strategyCandidates,
            decision: resolvedDecision.decision,
            note: `Auto-guardada por el vigilante del watchlist (${target.activeListName})`,
          });
          if (createdSignal?.id) {
            nextSignalRows.push(createdSignal);
            createdSignalAt = new Date().toISOString();
            if (executionProfile?.enabled && executionProfile?.autoExecuteEnabled) {
              if (autoExecutionAttempts >= MAX_AUTO_EXECUTION_ATTEMPTS_PER_SCAN) {
                nextAutoOrdersBlocked += 1;
                autoOrdersSkipped += 1;
              } else if (autoExecutionCooldownUntil > Date.now()) {
                nextAutoOrdersBlocked += 1;
                autoOrdersSkipped += 1;
              } else {
                try {
                  autoExecutionAttempts += 1;
                  const autoExecution = await executeSignalTradeForUser(target.username, createdSignal.id, "execute", {
                    origin: "watcher",
                  });
                  if (autoExecution?.record?.status === "placed") {
                    nextAutoOrdersPlaced += 1;
                  } else {
                    nextAutoOrdersBlocked += 1;
                  }
                } catch (error) {
                  nextAutoOrdersBlocked += 1;
                  const throttle = parseBinanceThrottle(error);
                  if (throttle) {
                    autoExecutionCooldownUntil = new Date(throttle.cooldownUntil).getTime();
                    autoExecutionCooldownReason = throttle.reason;
                  }
                  nextErrors.push(`${coin} ${timeframe}: auto-ejecución falló: ${error.message || "error desconocido"}`);
                }
              }
            }
          }
        }

        nextStateUpdates.push({
          username: target.username,
          coin,
          timeframe,
          last_scanned_at: new Date().toISOString(),
          last_strategy_id: resolvedDecision.strategy?.id || snapshot.primary.strategy.id,
          last_strategy_version: resolvedDecision.strategy?.version || snapshot.primary.strategy.version,
          last_signal_created_at: createdSignalAt,
          last_summary: {
            signalLabel: resolvedDecision.signal?.label || snapshot.primary.signal.label,
            score: resolvedDecision.signal?.score || snapshot.primary.signal.score,
            setupType: resolvedDecision.analysis?.setupType || snapshot.primary.analysis.setupType,
            strategy: resolvedDecision.strategy?.label || snapshot.primary.strategy.label,
          },
        });
      } catch (error) {
        nextErrors.push(`${coin} ${timeframe}: ${error.message || "error desconocido"}`);
      }
    }

    return {
      priceMap: nextPriceMap,
      stateUpdates: nextStateUpdates,
      signalRows: nextSignalRows,
      autoOrdersPlaced: nextAutoOrdersPlaced,
      autoOrdersBlocked: nextAutoOrdersBlocked,
      scannedFrames: nextScannedFrames,
      errors: nextErrors,
    };
  });

  coinResults.forEach((result) => {
    Object.assign(priceMap, result.priceMap);
    stateUpdates.push(...result.stateUpdates);
    signalRows.push(...result.signalRows);
    autoOrdersPlaced += result.autoOrdersPlaced;
    autoOrdersBlocked += result.autoOrdersBlocked;
    scannedFrames += result.scannedFrames;
    errors.push(...result.errors);
  });

  const closedSignals = await evaluatePendingSignalsForUser(target.username, priceMap, {
    notePrefix: "Auto-cerrada por el vigilante del watchlist",
  }).catch(() => []);

  stateUpdates.push(buildScannerSystemStateRow(target.username, previousSystemSummary, {
    autoExecutionCooldownUntil: autoExecutionCooldownUntil > Date.now()
      ? new Date(autoExecutionCooldownUntil).toISOString()
      : null,
    autoExecutionCooldownReason: autoExecutionCooldownUntil > Date.now() ? autoExecutionCooldownReason : "",
    lastRunSource: scanSource,
    lastRunSignalsCreated: signalRows.length,
    lastRunSignalsClosed: closedSignals.length,
    lastRunFramesScanned: scannedFrames,
    lastRunAutoOrdersPlaced: autoOrdersPlaced,
    lastRunAutoOrdersBlocked: autoOrdersBlocked,
    lastRunAutoOrdersSkipped: autoOrdersSkipped,
    lastRunAutoExecutionAttempts: autoExecutionAttempts,
    lastRunHadErrors: errors.length > 0,
  }));

  await upsertScanState(stateUpdates);
  let runPersistError = null;
  try {
    await createScanRun({
      username: target.username,
      active_list_name: target.activeListName,
      scan_source: scanSource,
      coins_count: coins.length,
      frames_scanned: scannedFrames,
      signals_created: signalRows.length,
      signals_closed: closedSignals.length,
      status: errors.length ? "partial" : "ok",
      errors,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    runPersistError = error.message || "No se pudo guardar el resumen del vigilante";
  }

  return {
    username: target.username,
    activeListName: target.activeListName,
    coinsCount: coins.length,
    scannedFrames,
    signalsCreated: signalRows.length,
    signalsClosed: closedSignals.length,
    autoOrdersPlaced,
    autoOrdersBlocked,
    autoOrdersSkipped,
    errors,
    runPersistError,
    autoExecutionCooldownUntil: autoExecutionCooldownUntil > Date.now()
      ? new Date(autoExecutionCooldownUntil).toISOString()
      : null,
  };
}

export async function runWatchlistScan(req) {
  const schedulerMode = canRunAsScheduler(req);
  const session = schedulerMode ? null : getSession(req);
  const username = req.query?.username ? String(req.query.username) : session?.username || null;

  if (!schedulerMode && !session) {
    throw new Error("No autorizado para ejecutar el vigilante del watchlist");
  }

  const targets = await listWatchlistScanTargets(username);
  if (!targets.length) {
    return {
      mode: schedulerMode ? "scheduler" : "manual",
      targets: [],
      summary: { users: 0, signalsCreated: 0, signalsClosed: 0, framesScanned: 0 },
    };
  }

  const results = [];
  for (const target of targets) {
    results.push(await scanUserWatchlist(target, schedulerMode ? "scheduler" : "manual"));
  }

  return {
    mode: schedulerMode ? "scheduler" : "manual",
    targets: results,
    summary: {
      users: results.length,
      signalsCreated: results.reduce((sum, item) => sum + item.signalsCreated, 0),
      signalsClosed: results.reduce((sum, item) => sum + item.signalsClosed, 0),
      autoOrdersPlaced: results.reduce((sum, item) => sum + item.autoOrdersPlaced, 0),
      autoOrdersBlocked: results.reduce((sum, item) => sum + item.autoOrdersBlocked, 0),
      framesScanned: results.reduce((sum, item) => sum + item.scannedFrames, 0),
      runPersistErrors: results.map((item) => item.runPersistError).filter(Boolean),
    },
  };
}

export async function getWatchlistScannerStatus(req) {
  const schedulerMode = canRunAsScheduler(req);
  const session = schedulerMode ? null : getSession(req);
  const username = req.query?.username ? String(req.query.username) : session?.username || null;

  if (!schedulerMode && !session) {
    throw new Error("No autorizado para consultar el vigilante del watchlist");
  }

  const targets = await listWatchlistScanTargets(username);
  const runs = await listRecentRuns(username);
  const schedulerRuns = (runs || []).filter((item) => item.scan_source === "scheduler");
  const latestRun = runs?.[0] || null;
  const scanState = username ? await getScanState(username).catch(() => new Map()) : new Map();
  const systemSummary = getScannerSystemState(scanState);

  return {
    username,
    targets: targets.map((item) => ({
      username: item.username,
      activeListName: item.activeListName,
      coinsCount: item.coins.length,
      coins: item.coins,
    })),
    latestRun,
    latestSchedulerRun: schedulerRuns[0] || null,
    runs: runs || [],
    summary: {
      watchedUsers: targets.length,
      watchedCoins: targets.reduce((sum, item) => sum + item.coins.length, 0),
      schedulerRuns: schedulerRuns.length,
      autoExecutionCooldownUntil: systemSummary?.autoExecutionCooldownUntil || null,
      autoExecutionCooldownActive: getScannerCooldownUntil(systemSummary) > Date.now(),
      autoExecutionCooldownReason: String(systemSummary?.autoExecutionCooldownReason || ""),
    },
  };
}

export { sendJson };
