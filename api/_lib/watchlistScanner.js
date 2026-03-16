import { getSession, sendJson } from "./auth.js";
import { buildMarketSnapshot, fetchTickerPrice, getScannableTimeframes, getTimeframeScanInterval } from "./marketRuntime.js";
import { createSignalSnapshotForUser, evaluatePendingSignalsForUser } from "./signals.js";
import { listWatchlistScanTargets } from "./watchlist.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WATCHLIST_SCAN_STATE_TABLE = process.env.SUPABASE_WATCHLIST_SCAN_STATE_TABLE || "watchlist_scan_state";
const WATCHLIST_SCAN_RUNS_TABLE = process.env.SUPABASE_WATCHLIST_SCAN_RUNS_TABLE || "watchlist_scan_runs";

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

async function scanUserWatchlist(target, scanSource) {
  const scanState = await getScanState(target.username);
  const coins = Array.from(new Set(target.coins || []));
  const timeframes = getScannableTimeframes();
  const priceMap = {};
  const stateUpdates = [];
  const signalRows = [];
  const errors = [];
  let scannedFrames = 0;

  for (const coin of coins) {
    const ticker = await fetchTickerPrice(coin).catch(() => null);
    if (ticker?.lastPrice) {
      priceMap[coin] = ticker.lastPrice;
    }

    for (const timeframe of timeframes) {
      const stateKey = `${coin}|${timeframe}`;
      const previousState = scanState.get(stateKey);
      if (!shouldScanNow(previousState?.last_scanned_at, timeframe)) {
        continue;
      }

      try {
        const snapshot = await buildMarketSnapshot(coin, timeframe);
        scannedFrames += 1;
        let createdSignalAt = previousState?.last_signal_created_at || null;

        if (isActionableSignal(snapshot)) {
          const createdSignal = await createSignalSnapshotForUser(target.username, {
            coin,
            timeframe,
            signal: snapshot.primary.signal,
            analysis: snapshot.primary.analysis,
            plan: snapshot.plan,
            multiTimeframes: snapshot.multiTimeframes,
            strategy: snapshot.primary.strategy,
            strategyCandidates: snapshot.candidates,
            note: `Auto-guardada por el vigilante del watchlist (${target.activeListName})`,
          });
          if (createdSignal?.id) {
            signalRows.push(createdSignal);
            createdSignalAt = new Date().toISOString();
          }
        }

        stateUpdates.push({
          username: target.username,
          coin,
          timeframe,
          last_scanned_at: new Date().toISOString(),
          last_strategy_id: snapshot.primary.strategy.id,
          last_strategy_version: snapshot.primary.strategy.version,
          last_signal_created_at: createdSignalAt,
          last_summary: {
            signalLabel: snapshot.primary.signal.label,
            score: snapshot.primary.signal.score,
            setupType: snapshot.primary.analysis.setupType,
            strategy: snapshot.primary.strategy.label,
          },
        });
      } catch (error) {
        errors.push(`${coin} ${timeframe}: ${error.message || "error desconocido"}`);
      }
    }
  }

  const closedSignals = await evaluatePendingSignalsForUser(target.username, priceMap, {
    notePrefix: "Auto-cerrada por el vigilante del watchlist",
  }).catch(() => []);

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
    errors,
    runPersistError,
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
  const latestRun = runs?.[0] || null;

  return {
    username,
    targets: targets.map((item) => ({
      username: item.username,
      activeListName: item.activeListName,
      coinsCount: item.coins.length,
      coins: item.coins,
    })),
    latestRun,
    runs: runs || [],
    summary: {
      watchedUsers: targets.length,
      watchedCoins: targets.reduce((sum, item) => sum + item.coins.length, 0),
    },
  };
}

export { sendJson };
