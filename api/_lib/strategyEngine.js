import { getSession, parseJsonBody, sendJson } from "./auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STRATEGY_REGISTRY_TABLE = process.env.SUPABASE_STRATEGY_REGISTRY_TABLE || "strategy_registry";
const STRATEGY_VERSIONS_TABLE = process.env.SUPABASE_STRATEGY_VERSIONS_TABLE || "strategy_versions";
const STRATEGY_EXPERIMENTS_TABLE = process.env.SUPABASE_STRATEGY_EXPERIMENTS_TABLE || "strategy_experiments";

const FALLBACK_REGISTRY = [
  {
    id: 1,
    strategy_id: "trend-alignment",
    label: "Trend Alignment",
    description: "Estrategia base de tendencia, momentum y alineación de marcos.",
    category: "trend",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    strategy_id: "breakout",
    label: "Breakout",
    description: "Estrategia de ruptura con confirmación de volumen y contexto mayor.",
    category: "breakout",
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const FALLBACK_VERSIONS = [
  {
    id: 1,
    strategy_id: "trend-alignment",
    version: "v1",
    label: "Trend Alignment v1",
    parameters: {
      trendWeight: 20,
      oversoldBoost: 15,
      overboughtPenalty: 15,
      buyThreshold: 65,
      sellThreshold: 35,
    },
    notes: "Versión inicial basada en tendencia, RSI y alineación.",
    status: "active",
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    strategy_id: "breakout",
    version: "v1",
    label: "Breakout v1",
    parameters: {
      lookbackCandles: 20,
      breakoutBufferPct: 0.1,
      volumeThreshold: 1.15,
      buyThreshold: 68,
      sellThreshold: 32,
    },
    notes: "Versión inicial basada en ruptura de rango y volumen.",
    status: "active",
    created_at: new Date().toISOString(),
  },
];

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase no está configurado para el motor de estrategias");
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

export async function listStrategyEngine(req) {
  requireSession(req);

  try {
    const registryParams = new URLSearchParams({
      select: "*",
      order: "strategy_id.asc",
    });
    const versionsParams = new URLSearchParams({
      select: "*",
      order: "strategy_id.asc,version.asc",
    });
    const experimentsParams = new URLSearchParams({
      select: "*",
      order: "created_at.desc",
      limit: "50",
    });

    const [registry, versions, experiments] = await Promise.all([
      supabaseRequest(`${STRATEGY_REGISTRY_TABLE}?${registryParams.toString()}`),
      supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${versionsParams.toString()}`),
      supabaseRequest(`${STRATEGY_EXPERIMENTS_TABLE}?${experimentsParams.toString()}`),
    ]);

    return {
      registry: registry || [],
      versions: versions || [],
      experiments: experiments || [],
    };
  } catch {
    return {
      registry: FALLBACK_REGISTRY,
      versions: FALLBACK_VERSIONS,
      experiments: [],
    };
  }
}

export async function createStrategyExperiment(req) {
  requireSession(req);
  const body = parseJsonBody(req);

  const baseStrategyId = String(body.baseStrategyId || "").trim();
  const candidateStrategyId = String(body.candidateStrategyId || "").trim();
  const candidateVersion = String(body.candidateVersion || "v1").trim();
  const marketScope = String(body.marketScope || "all").trim();
  const timeframeScope = String(body.timeframeScope || "all").trim();
  const summary = String(body.summary || "").trim();

  if (!baseStrategyId || !candidateStrategyId || !candidateVersion) {
    throw new Error("Faltan datos para crear el experimento");
  }

  const experimentKey = [
    baseStrategyId,
    candidateStrategyId,
    candidateVersion,
    marketScope || "all",
    timeframeScope || "all",
    Date.now(),
  ].join(":");

  try {
    const rows = await supabaseRequest(STRATEGY_EXPERIMENTS_TABLE, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: [{
        experiment_key: experimentKey,
        base_strategy_id: baseStrategyId,
        candidate_strategy_id: candidateStrategyId,
        candidate_version: candidateVersion,
        market_scope: marketScope,
        timeframe_scope: timeframeScope,
        status: "draft",
        summary,
        metadata: {
          createdFrom: "signals-lab",
        },
      }],
    });

    return rows?.[0] || null;
  } catch {
    return {
      id: Date.now(),
      experiment_key: experimentKey,
      base_strategy_id: baseStrategyId,
      candidate_strategy_id: candidateStrategyId,
      candidate_version: candidateVersion,
      market_scope: marketScope,
      timeframe_scope: timeframeScope,
      status: "draft",
      summary,
      metadata: { createdFrom: "signals-lab", fallback: true },
      created_at: new Date().toISOString(),
    };
  }
}

export async function updateStrategyExperiment(req) {
  requireSession(req);
  const body = parseJsonBody(req);
  const id = Number(body.id || 0);
  if (!id) throw new Error("Falta el experimento a actualizar");

  const patch = {};
  if (body.status) patch.status = String(body.status);
  if (typeof body.summary === "string") patch.summary = String(body.summary);
  if (!Object.keys(patch).length) {
    throw new Error("No hay cambios para actualizar");
  }

  const params = new URLSearchParams({
    id: `eq.${id}`,
  });

  const rows = await supabaseRequest(`${STRATEGY_EXPERIMENTS_TABLE}?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: patch,
  });

  return rows?.[0] || null;
}

export { sendJson };
