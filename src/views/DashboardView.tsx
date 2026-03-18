import { useState } from "react";
import {
  BoltIcon,
  CheckCircleIcon,
  CoinsIcon,
  DownloadIcon,
  HelpCircleIcon,
  InfoCircleIcon,
  SparklesIcon,
  TrendUpIcon,
  WarningTriangleIcon,
  WalletIcon,
} from "../components/Icons";
import { formatPct, formatPrice, formatSignedPct, formatSignedPrice } from "../lib/format";
import type {
  Candle,
  DashboardAnalysis,
  ExecutionCenterPayload,
  ExecutionOrderRecord,
  OperationPlan,
  PortfolioPayload,
  Signal,
  StrategyCandidate,
  StrategyDescriptor,
  TimeframeSignal,
} from "../types";
import { openHelp } from "../lib/ui-events";

interface DashboardViewProps {
  currentCoin: string;
  timeframe: string;
  currentPrice: number;
  signal: Signal | null;
  plan: OperationPlan | null;
  analysis: DashboardAnalysis | null;
  strategy: StrategyDescriptor;
  strategyCandidates: StrategyCandidate[];
  strategyRefreshIntervalMs: number;
  multiTimeframes: TimeframeSignal[];
  candles: Candle[];
  chartRef: React.RefObject<HTMLCanvasElement | null>;
  portfolioData: PortfolioPayload | null;
  executionCenter: ExecutionCenterPayload | null;
  onSaveSignal: () => void;
}

type DashboardTab = "overview" | "bot-performance" | "capital" | "activity";

export function DashboardView(props: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const signal = props.signal;
  const analysis = props.analysis;
  const portfolio = props.portfolioData?.portfolio;
  const assets = props.portfolioData?.assets || [];
  const executionAccount = props.executionCenter?.account;
  const executionProfile = props.executionCenter?.profile;
  const currentPrice = props.currentPrice || props.candles.at(-1)?.close || 0;
  const firstClose = props.candles[0]?.close ?? currentPrice;
  const marketDriftPct = firstClose > 0 ? ((currentPrice - firstClose) / firstClose) * 100 : 0;
  const portfolioTotal = portfolio?.totalValue ?? executionAccount?.totalValue ?? 0;
  const portfolioChangeValue = portfolio?.periodChangeValue ?? 0;
  const portfolioChangePct = portfolio?.periodChangePct ?? marketDriftPct;
  const activeBots = executionProfile?.enabled ? 1 : 0;
  const totalBots = 1;
  const activeBotsLabel = `${activeBots} / ${totalBots}`;
  const last24hCutoff = Date.now() - 24 * 60 * 60 * 1000;

  const recentExecuteOrders = (props.executionCenter?.recentOrders || []).filter((item) => item.mode === "execute");
  const botClosedOrders24h = recentExecuteOrders.filter((item) => {
    const closedAt = item.closed_at ? new Date(item.closed_at).getTime() : 0;
    return closedAt >= last24hCutoff && Number.isFinite(closedAt);
  });
  const botGeneratedPnl24h = botClosedOrders24h.reduce((sum, item) => sum + Number(item.realized_pnl || 0), 0);
  const botOutcomes24h = botClosedOrders24h.filter((item) => {
    const status = String(item.lifecycle_status || item.signal_outcome_status || "");
    return status === "closed_win" || status === "closed_loss" || status === "win" || status === "loss" || typeof item.realized_pnl === "number";
  });
  const botWins24h = botOutcomes24h.filter((item) => isPositiveClosedOutcome(item)).length;
  const botWinRate24h = botOutcomes24h.length ? (botWins24h / botOutcomes24h.length) * 100 : 0;
  const botsPnlTone = botGeneratedPnl24h > 0 ? "positive" : botGeneratedPnl24h < 0 ? "negative" : "neutral";
  const eligibleCandidates = (props.executionCenter?.candidates || []).filter((item) => item.status === "eligible");
  const blockedCandidates = (props.executionCenter?.candidates || []).filter((item) => item.status === "blocked");
  const recentOrders = recentExecuteOrders.slice(0, 5);
  const deployedCapitalValue = portfolio?.positionsValue || 0;
  const deploymentPct = portfolioTotal > 0 ? ((deployedCapitalValue / portfolioTotal) * 100) : 0;
  const cashPct = portfolioTotal > 0 ? (((portfolio?.cashValue || 0) / portfolioTotal) * 100) : 0;
  const allocationItems = buildDashboardAllocation(assets);
  const allocationGradient = buildAllocationGradient(allocationItems);
  const tabSummary = getDashboardTabSummary(activeTab, {
    portfolioTotal,
    portfolioChangeValue,
    deploymentPct,
    deployedCapitalValue,
    cashPct,
    executionAccount,
    executionProfile,
    eligibleCount: eligibleCandidates.length,
    blockedCount: blockedCandidates.length,
    recentOrdersCount: recentOrders.length,
    currentCoin: props.currentCoin,
    timeframe: props.timeframe,
    botGeneratedPnl24h,
    botWinRate24h,
  });
  const riskAlerts = buildRiskAlerts({
    executionAccount,
    executionProfile,
    blockedCount: blockedCandidates.length,
    analysis,
    signal,
  });
  const operatingSignals = buildOperatingSignals({
    executionAccount,
    executionProfile,
    eligibleCount: eligibleCandidates.length,
    blockedCount: blockedCandidates.length,
    strategy: props.strategy,
    analysis,
    currentCoin: props.currentCoin,
    currentTimeframe: props.timeframe,
  });

  return (
    <div id="dashboardView" className="view-panel active">
      <div className="dashboard-shell">
        <section className="dashboard-overview">
          <div className="dashboard-overview-head">
            <div className="dashboard-overview-copy">
              <h1 className="dashboard-overview-title">Dashboard</h1>
              <p className="dashboard-overview-subtitle">
                Centro de mando de CRYPE para vigilar capital, bot operativo, IA, ejecución demo y presión del mercado sin convertir esta vista en una pantalla de señales.
              </p>
            </div>
            <div className="dashboard-overview-actions">
              <button type="button" className="ui-button" onClick={props.onSaveSignal}>
                <DownloadIcon />
                Exportar snapshot
              </button>
              <button
                type="button"
                className="ui-button ui-button-primary"
                onClick={() => openHelp({
                  title: "Separación Dashboard vs Signal Bot",
                  body: "Dashboard resume el estado de la plataforma. Signal Bot es donde vive la lectura más operativa del bot, su edge, ejecución y memoria.",
                  bullets: [
                    "Dashboard: comando, salud del sistema, capital y actividad.",
                    "Signal Bot: setups, validación, aprendizaje y control fino.",
                  ],
                })}
              >
                <SparklesIcon />
                Signal Bot
              </button>
            </div>
          </div>

          <div className="dashboard-overview-grid">
            <article className="dashboard-overview-card ui-summary-card ui-interactive-surface">
              <div className="dashboard-overview-card-top">
                <span className="dashboard-overview-icon dashboard-overview-icon-wallet">
                  <WalletIcon />
                </span>
                <span className={`dashboard-overview-badge ${getSignedTone(portfolioChangePct)}`}>
                  {formatSignedPct(portfolioChangePct)}
                </span>
              </div>
              <div className="dashboard-overview-label">Total portfolio</div>
              <div className="dashboard-overview-value">{formatPrice(portfolioTotal)}</div>
              <div className="dashboard-overview-divider" />
              <div className="dashboard-overview-foot">
                <span>Capital líquido</span>
                <strong>{formatPrice(portfolio?.cashValue || 0)}</strong>
              </div>
            </article>

            <article className="dashboard-overview-card ui-summary-card ui-interactive-surface">
              <div className="dashboard-overview-card-top">
                <span className="dashboard-overview-icon dashboard-overview-icon-bots">
                  <CoinsIcon />
                </span>
                <span className={`dashboard-overview-status${activeBots ? "" : " inactive"}`}>
                  <span className="dashboard-overview-status-dot" />
                  {activeBots ? "Running" : "Standby"}
                </span>
              </div>
              <div className="dashboard-overview-label">Bots activos</div>
              <div className="dashboard-overview-value">{activeBotsLabel}</div>
              <div className="dashboard-overview-divider" />
              <div className="dashboard-overview-foot">
                <span>Órdenes abiertas</span>
                <strong>{executionAccount?.openOrdersCount ?? 0}</strong>
              </div>
            </article>

            <article className="dashboard-overview-card ui-summary-card ui-interactive-surface">
              <div className="dashboard-overview-card-top">
                <span className="dashboard-overview-icon dashboard-overview-icon-intelligence">
                  <TrendUpIcon />
                </span>
                <span className={`dashboard-overview-badge ${botsPnlTone}`}>
                  {botGeneratedPnl24h >= 0 ? "Profit" : "Drawdown"}
                </span>
              </div>
              <div className="dashboard-overview-label">Generado por bots (24h)</div>
              <div className={`dashboard-overview-value ${botsPnlTone}`}>{formatPrice(botGeneratedPnl24h)}</div>
              <div className="dashboard-overview-divider" />
              <div className="dashboard-overview-foot">
                <span>Win rate bot activo</span>
                <strong>{formatPct(botWinRate24h)}</strong>
              </div>
            </article>

            <article className="dashboard-overview-card ui-summary-card ui-interactive-surface">
              <div className="dashboard-overview-card-top">
                <span className="dashboard-overview-icon dashboard-overview-icon-context">
                  <SparklesIcon />
                </span>
                <span className="dashboard-overview-badge neutral">
                  {formatPct(deploymentPct)}
                </span>
              </div>
              <div className="dashboard-overview-label">Capital en ejecución</div>
              <div className="dashboard-overview-value">{formatPrice(deployedCapitalValue)}</div>
              <div className="dashboard-overview-divider" />
              <div className="dashboard-overview-foot">
                <span>% del portfolio desplegado</span>
                <strong>{formatPct(deploymentPct)}</strong>
              </div>
            </article>
          </div>
        </section>

        <section className="dashboard-tabs-section">
          <div className="dashboard-tab-row">
            {DASHBOARD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`dashboard-tab-pill ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="dashboard-analytics-card">
            <div className="dashboard-panel-head">
              <div>
                <div className="dashboard-panel-kicker">{tabSummary.kicker}</div>
                <h2 className="dashboard-panel-title">{tabSummary.title}</h2>
                <p className="dashboard-panel-subtitle">{tabSummary.subtitle}</p>
              </div>
              <DashboardHelpButton
                title={tabSummary.title}
                body={tabSummary.helpBody}
                bullets={tabSummary.helpBullets}
              />
            </div>

            <div className="dashboard-analytics-grid">
              <div className="dashboard-chart-shell">
                <div className="chart-container dashboard-chart-card">
                  <div className="chart-header">
                    <div>
                      <div className="dashboard-card-topline">
                        <div className="chart-title">{tabSummary.chartTitle}</div>
                      </div>
                      <div className="card-subtitle">{tabSummary.chartSubtitle}</div>
                    </div>
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-dot green" />
                        Precio
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot blue" />
                        SMA 20
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot orange" />
                        SMA 50
                      </div>
                    </div>
                  </div>
                  <canvas ref={props.chartRef} />
                </div>

                <div className="dashboard-kpi-grid">
                  {tabSummary.metrics.map((item) => (
                    <article key={item.label} className="dashboard-kpi-tile ui-interactive-surface">
                      <span className="dashboard-kpi-label">{item.label}</span>
                      <strong className={`dashboard-kpi-value ${item.tone || ""}`.trim()}>{item.value}</strong>
                      <span className="dashboard-kpi-note">{item.note}</span>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="dashboard-side-card dashboard-tab-side-card">
                {activeTab === "overview" ? (
                  <>
                    <div className="dashboard-panel-head">
                      <div>
                        <div className="dashboard-panel-kicker">Capital map</div>
                        <h3 className="dashboard-side-title">Asignación del portfolio</h3>
                      </div>
                    </div>
                    <div className="dashboard-allocation-shell">
                      <div className="dashboard-allocation-donut" style={{ background: allocationGradient }}>
                        <div className="dashboard-allocation-center">
                          <strong>{allocationItems.length}</strong>
                          <span>activos top</span>
                        </div>
                      </div>
                      <div className="ui-legend">
                        {allocationItems.map((item) => (
                          <div key={item.asset} className="ui-legend-row">
                            <div className="ui-legend-key">
                              <span className="ui-legend-dot" style={{ background: item.color }} />
                              <span>{item.asset}</span>
                            </div>
                            <strong>{formatPct(item.sharePct)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {activeTab === "bot-performance" ? (
                  <>
                    <div className="dashboard-panel-head">
                      <div>
                        <div className="dashboard-panel-kicker">Bot lane</div>
                        <h3 className="dashboard-side-title">Flujo del Signal Bot</h3>
                      </div>
                    </div>
                    <div className="dashboard-funnel-list">
                      <div className="dashboard-funnel-row">
                        <span>Candidatos elegibles</span>
                        <strong>{String(eligibleCandidates.length)}</strong>
                      </div>
                      <div className="dashboard-funnel-row">
                        <span>Candidatos bloqueados</span>
                        <strong>{String(blockedCandidates.length)}</strong>
                      </div>
                      <div className="dashboard-funnel-row">
                        <span>Autoejecuciones restantes</span>
                        <strong>{String(executionAccount?.autoExecutionRemaining ?? 0)}</strong>
                      </div>
                    </div>
                    <div className="dashboard-signal-stack">
                      {operatingSignals.map((item) => (
                        <article key={item.label} className={`dashboard-signal-card ${item.tone} ui-interactive-surface`}>
                          <div className="dashboard-signal-card-head">
                            <span className="dashboard-signal-icon">{item.icon}</span>
                            <span className={`dashboard-signal-pill ${item.tone}`}>{item.pill}</span>
                          </div>
                          <div className="dashboard-signal-title">{item.label}</div>
                          <div className="dashboard-signal-body">{item.detail}</div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}

                {activeTab === "capital" ? (
                  <>
                    <div className="dashboard-panel-head">
                      <div>
                        <div className="dashboard-panel-kicker">Capital desk</div>
                        <h3 className="dashboard-side-title">Distribución activa</h3>
                      </div>
                    </div>
                    <div className="dashboard-side-metrics">
                      <div className="dashboard-side-metric">
                        <span>Capital desplegado</span>
                        <strong>{formatPrice(deployedCapitalValue)}</strong>
                      </div>
                      <div className="dashboard-side-metric">
                        <span>Caja disponible</span>
                        <strong>{formatPrice(portfolio?.cashValue || 0)}</strong>
                      </div>
                      <div className="dashboard-side-metric">
                        <span>Open P&amp;L</span>
                        <strong className={getSignedTone(portfolio?.unrealizedPnl || 0)}>{formatSignedPrice(portfolio?.unrealizedPnl || 0)}</strong>
                      </div>
                      <div className="dashboard-side-metric">
                        <span>Ganadoras</span>
                        <strong>{String(portfolio?.winnersCount || 0)}</strong>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeTab === "activity" ? (
                  <>
                    <div className="dashboard-panel-head">
                      <div>
                        <div className="dashboard-panel-kicker">Risk & activity</div>
                        <h3 className="dashboard-side-title">Actividad reciente</h3>
                      </div>
                    </div>
                    {!recentOrders.length ? (
                      <div className="dashboard-empty-state">
                        Aún no hay operaciones demo recientes para mostrar en esta vista.
                      </div>
                    ) : (
                      <div className="dashboard-compact-activity">
                        {recentOrders.slice(0, 4).map((item) => (
                          <article key={item.id} className="dashboard-compact-row">
                            <div>
                              <strong>{item.coin || "Signal Bot"}</strong>
                              <span>{getOrderStatusLabel(item)} · {item.timeframe || props.timeframe}</span>
                            </div>
                            <strong className={getOrderTone(item)}>
                              {item.realized_pnl != null ? formatSignedPrice(item.realized_pnl) : formatPrice(item.notional_usd || 0)}
                            </strong>
                          </article>
                        ))}
                      </div>
                    )}
                    <div className="dashboard-alert-list">
                      {riskAlerts.map((item) => (
                        <article key={item.title} className={`dashboard-alert-item ${item.tone}`}>
                          <div className="dashboard-alert-icon">
                            {item.tone === "good" ? <CheckCircleIcon /> : item.tone === "warn" ? <WarningTriangleIcon /> : <InfoCircleIcon />}
                          </div>
                          <div className="dashboard-alert-copy">
                            <strong>{item.title}</strong>
                            <span>{item.body}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </aside>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

interface DashboardHelpButtonProps {
  title: string;
  body: string;
  bullets?: string[];
  footer?: string;
}

function DashboardHelpButton(props: DashboardHelpButtonProps) {
  return (
    <button
      type="button"
      className="card-help-button dashboard-help-button"
      aria-label={`Ayuda sobre ${props.title}`}
      onClick={() => openHelp({
        title: props.title,
        body: props.body,
        bullets: props.bullets,
        footer: props.footer,
      })}
    >
      <HelpCircleIcon />
    </button>
  );
}

function getSignedTone(value: number) {
  if (value > 0.1) return "positive";
  if (value < -0.1) return "negative";
  return "neutral";
}

function isPositiveClosedOutcome(item: ExecutionOrderRecord) {
  const status = String(item.lifecycle_status || item.signal_outcome_status || "");
  if (status === "closed_win" || status === "win") return true;
  if (status === "closed_loss" || status === "loss") return false;
  return Number(item.realized_pnl || 0) > 0;
}

function getOrderTone(item: ExecutionOrderRecord) {
  const lifecycle = String(item.lifecycle_status || item.status || "");
  if (lifecycle === "closed_win" || lifecycle === "win") return "positive";
  if (lifecycle === "closed_loss" || lifecycle === "loss") return "negative";
  if (typeof item.realized_pnl === "number") return item.realized_pnl > 0 ? "positive" : item.realized_pnl < 0 ? "negative" : "neutral";
  return "neutral";
}

function getOrderStatusLabel(item: ExecutionOrderRecord) {
  const lifecycle = String(item.lifecycle_status || item.status || "");
  if (lifecycle === "placed") return "Operación abierta";
  if (lifecycle === "protected") return "Protección activa";
  if (lifecycle === "filled_unprotected") return "Abierta sin protección";
  if (lifecycle === "closed_win") return "Cierre en ganancia";
  if (lifecycle === "closed_loss") return "Cierre en pérdida";
  return lifecycle || "Sin estado";
}

function buildOperatingSignals(input: {
  executionAccount: ExecutionCenterPayload["account"] | null | undefined;
  executionProfile: ExecutionCenterPayload["profile"] | null | undefined;
  eligibleCount: number;
  blockedCount: number;
  strategy: StrategyDescriptor;
  analysis: DashboardAnalysis | null;
  currentCoin: string;
  currentTimeframe: string;
}) {
  return [
    {
      label: "Watcher y ejecución",
      detail: input.executionProfile?.enabled
        ? `Signal Bot está habilitado y ${input.executionProfile.autoExecuteEnabled ? "puede autoejecutar en demo" : "opera con control humano"}`
        : "El bot está deshabilitado y la plataforma quedó en observación",
      pill: input.executionProfile?.enabled ? "Online" : "Standby",
      tone: input.executionProfile?.enabled ? "good" : "warn",
      icon: <BoltIcon />,
    },
    {
      label: "Embudo inmediato",
      detail: `${input.eligibleCount} setup(s) listos y ${input.blockedCount} frenados por filtros, riesgo o límites diarios`,
      pill: input.eligibleCount ? "Flow" : "Quiet",
      tone: input.eligibleCount ? "info" : "neutral",
      icon: <CoinsIcon />,
    },
    {
      label: "Motor activo",
      detail: `${input.strategy.label} prioriza ${input.currentCoin} en ${input.currentTimeframe} con sesgo ${input.analysis?.higherTimeframeBias || "mixto"}`,
      pill: "IA",
      tone: "info",
      icon: <SparklesIcon />,
    },
  ];
}

function buildRiskAlerts(input: {
  executionAccount: ExecutionCenterPayload["account"] | null | undefined;
  executionProfile: ExecutionCenterPayload["profile"] | null | undefined;
  blockedCount: number;
  analysis: DashboardAnalysis | null;
  signal: Signal | null;
}) {
  const alerts = [];

  if (!input.executionAccount?.connected) {
    alerts.push({
      title: "Binance Demo no está conectada",
      body: "La plataforma puede seguir leyendo mercado, pero no podrá reflejar capital ni ejecución demo real.",
      tone: "warn",
    });
  } else {
    alerts.push({
      title: "Conexión demo disponible",
      body: "El módulo de balance y ejecución está listo para seguir operando y reportando actividad.",
      tone: "good",
    });
  }

  if ((input.executionAccount?.dailyLossPct || 0) >= (input.executionProfile?.maxDailyLossPct || 0) * 0.8 && (input.executionProfile?.maxDailyLossPct || 0) > 0) {
    alerts.push({
      title: "Pérdida diaria cerca del límite",
      body: `Va ${Number(input.executionAccount?.dailyLossPct || 0).toFixed(2)}% de ${(input.executionProfile?.maxDailyLossPct || 0).toFixed(2)}% permitido.`,
      tone: "warn",
    });
  }

  if (input.blockedCount > 0) {
    alerts.push({
      title: "Hay setups siendo rechazados",
      body: `${input.blockedCount} oportunidad(es) quedaron fuera por edge guard, score, RR o límites operativos.`,
      tone: "info",
    });
  }

  if ((input.executionAccount?.recentLossStreak || 0) >= Math.max(2, input.executionProfile?.cooldownAfterLosses || 0)) {
    alerts.push({
      title: "Racha reciente bajo vigilancia",
      body: "El sistema ya acumuló pérdidas recientes; conviene observar si el filtro debe endurecerse más.",
      tone: "warn",
    });
  }

  if ((input.signal?.score || 0) >= 70 && input.analysis?.setupQuality === "Alta") {
    alerts.push({
      title: "Contexto limpio en observación",
      body: "Hay una lectura de buena calidad, pero el Dashboard solo la resume; la decisión fina pertenece a Signal Bot.",
      tone: "good",
    });
  }

  if (!alerts.length) {
    alerts.push({
      title: "Sin alertas críticas",
      body: "La plataforma no muestra frenos severos en este momento.",
      tone: "good",
    });
  }

  return alerts.slice(0, 4);
}

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "bot-performance", label: "Bot Performance" },
  { id: "capital", label: "Capital" },
  { id: "activity", label: "Recent Activity" },
];

function buildDashboardAllocation(assets: PortfolioPayload["assets"]) {
  const ranked = [...assets]
    .filter((item) => Number(item.marketValue || 0) > 0)
    .sort((left, right) => Number(right.marketValue || 0) - Number(left.marketValue || 0))
    .slice(0, 5);
  const total = ranked.reduce((sum, item) => sum + Number(item.marketValue || 0), 0);
  const palette = ["#7c6df6", "#ff7a18", "#4ecdc4", "#5b6dff", "#f59e0b"];
  return ranked.map((item, index) => ({
    asset: item.asset,
    sharePct: total > 0 ? (Number(item.marketValue || 0) / total) * 100 : 0,
    color: palette[index] || "#94a3b8",
  }));
}

function buildAllocationGradient(items: Array<{ sharePct: number; color: string }>) {
  if (!items.length) return "conic-gradient(#cbd5e1 0deg 360deg)";
  let current = 0;
  const stops = items.map((item) => {
    const start = current;
    current += (item.sharePct / 100) * 360;
    return `${item.color} ${start}deg ${current}deg`;
  });
  if (current < 360) {
    stops.push(`#cbd5e1 ${current}deg 360deg`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

function getDashboardTabSummary(
  activeTab: DashboardTab,
  input: {
    portfolioTotal: number;
    portfolioChangeValue: number;
    deploymentPct: number;
    deployedCapitalValue: number;
    cashPct: number;
    executionAccount: ExecutionCenterPayload["account"] | null | undefined;
    executionProfile: ExecutionCenterPayload["profile"] | null | undefined;
    eligibleCount: number;
    blockedCount: number;
    recentOrdersCount: number;
    currentCoin: string;
    timeframe: string;
    botGeneratedPnl24h: number;
    botWinRate24h: number;
  },
) {
  switch (activeTab) {
    case "bot-performance":
      return {
        kicker: "Bot performance",
        title: "Lectura del bot y del embudo operativo",
        subtitle: "Las tabs viven fuera de la tarjeta y controlan este bloque, como en el template. Aquí el foco cae sobre rendimiento reciente y capacidad del bot.",
        chartTitle: "Pulso del bot",
        chartSubtitle: `${input.currentCoin} · ${input.timeframe} con lectura del bot como referencia visual`,
        helpBody: "Esta pestaña usa el gráfico como ancla visual y mueve el foco hacia el flujo del bot: setups, bloqueo y margen operativo.",
        helpBullets: [
          "Qué tanto del flujo pasa filtros.",
          "Cuánta capacidad demo queda.",
          "Qué tan sano viene el rendimiento inmediato.",
        ],
        metrics: [
          { label: "P&L bots 24h", value: formatSignedPrice(input.botGeneratedPnl24h), note: "Resultado cerrado reciente", tone: getSignedTone(input.botGeneratedPnl24h) },
          { label: "Win rate", value: formatPct(input.botWinRate24h), note: "Cierres recientes del bot" },
          { label: "Elegibles", value: String(input.eligibleCount), note: "Setups que sí pasan filtros" },
          { label: "Bloqueados", value: String(input.blockedCount), note: "Setups rechazados por edge guard" },
        ],
      };
    case "capital":
      return {
        kicker: "Capital",
        title: "Capital desplegado y capacidad restante",
        subtitle: "Esta vista prioriza cómo se reparte el portfolio entre caja y exposición real del sistema.",
        chartTitle: "Capital / contexto de mercado",
        chartSubtitle: "El gráfico ayuda a leer dónde está operando el capital dentro del movimiento actual",
        helpBody: "La pestaña de capital resume exposición, liquidez y presión sobre el portfolio sin irse a la pantalla de Wallet.",
        helpBullets: [
          "Capital desplegado en grande.",
          "Caja disponible como contrapeso.",
          "Lectura rápida de rendimiento abierto.",
        ],
        metrics: [
          { label: "Capital en ejecución", value: formatPrice(input.deployedCapitalValue), note: `${formatPct(input.deploymentPct)} del portfolio total` },
          { label: "Portfolio total", value: formatPrice(input.portfolioTotal), note: "Base completa del capital visible" },
          { label: "Caja", value: formatPct(input.cashPct), note: "Porcentaje líquido disponible" },
          { label: "24h P&L", value: formatSignedPrice(input.portfolioChangeValue), note: "Movimiento reciente del portfolio", tone: getSignedTone(input.portfolioChangeValue) },
        ],
      };
    case "activity":
      return {
        kicker: "Recent activity",
        title: "Actividad reciente y alertas del sistema",
        subtitle: "Esta pestaña se concentra en la traza operativa reciente y en lo que pide atención humana.",
        chartTitle: "Ritmo del mercado observado",
        chartSubtitle: "El gráfico sirve como contexto visual mientras el panel derecho resume actividad y alertas",
        helpBody: "La pestaña de actividad no convierte el Dashboard en Signal Bot; solo enseña la traza más ejecutiva.",
        helpBullets: [
          "Operaciones recientes.",
          "Alertas y frenos activos.",
          "Contexto rápido para supervisión.",
        ],
        metrics: [
          { label: "Órdenes recientes", value: String(input.recentOrdersCount), note: "Trazas demo recientes" },
          { label: "Auto restantes", value: String(input.executionAccount?.autoExecutionRemaining ?? 0), note: "Capacidad disponible hoy" },
          { label: "Loss streak", value: String(input.executionAccount?.recentLossStreak ?? 0), note: "Racha reciente bajo vigilancia" },
          { label: "Daily loss", value: `${Number(input.executionAccount?.dailyLossPct || 0).toFixed(2)}%`, note: "Consumo del límite diario" },
        ],
      };
    case "overview":
    default:
      return {
        kicker: "Overview",
        title: "Resumen visual de plataforma",
        subtitle: "Debajo de las 4 KPI queda esta tarjeta grande controlada por tabs externas, tal como el patrón del template, pero aterrizada a CRYPE.",
        chartTitle: "Mercado y performance visual",
        chartSubtitle: `${input.currentCoin} · ${input.timeframe} como ancla de lectura para plataforma, bot y capital`,
        helpBody: "La vista general busca una lectura rápida del estado de la plataforma sin bajar al detalle del bot.",
        helpBullets: [
          "Capital total y capital en ejecución.",
          "Rendimiento reciente del bot.",
          "Mapa visual más allocation del portfolio.",
        ],
        metrics: [
          { label: "Portfolio total", value: formatPrice(input.portfolioTotal), note: "Capital visible en la plataforma" },
          { label: "Capital desplegado", value: formatPct(input.deploymentPct), note: `${formatPrice(input.deployedCapitalValue)} en ejecución` },
          { label: "Bots 24h", value: formatSignedPrice(input.botGeneratedPnl24h), note: "Resultado reciente de bots", tone: getSignedTone(input.botGeneratedPnl24h) },
          { label: "Win rate", value: formatPct(input.botWinRate24h), note: "Cierres recientes del bot" },
        ],
      };
  }
}
