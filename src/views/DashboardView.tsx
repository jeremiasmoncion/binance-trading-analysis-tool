import { useEffect, useMemo, useState } from "react";
import {
  CoinsIcon,
  DownloadIcon,
  HelpCircleIcon,
  SparklesIcon,
  TrendUpIcon,
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
import { drawPerformanceChart } from "../lib/chart";

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
type DashboardRange = "24h" | "7d" | "30d" | "90d" | "all";

export function DashboardView(props: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [activeRange, setActiveRange] = useState<DashboardRange>("24h");
  const signal = props.signal;
  const analysis = props.analysis;
  const portfolio = props.portfolioData?.portfolio;
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
  const performancePoints = useMemo(
    () => buildPerformanceSeries(props.candles, portfolio, activeRange),
    [activeRange, portfolio, props.candles],
  );
  useEffect(() => {
    const isDark = document.body.classList.contains("dark-theme");
    drawPerformanceChart(props.chartRef.current, performancePoints, isDark);
  }, [performancePoints, props.chartRef]);

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

          <div className="dashboard-filter-card">
            <div className="dashboard-filter-group">
              <span className="dashboard-filter-label">Time Range:</span>
              <div className="dashboard-filter-chip-row">
                {DASHBOARD_RANGES.map((range) => (
                  <button
                    key={range.id}
                    type="button"
                    className={`dashboard-filter-chip ${activeRange === range.id ? "active" : ""}`}
                    onClick={() => setActiveRange(range.id)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-filter-actions">
              <button
                type="button"
                className="ui-button"
                onClick={() => openHelp({
                  title: "Filtros del Dashboard",
                  body: "Esta tarjeta intermedia controla la ventana visual del gráfico principal de rendimiento del portfolio.",
                  bullets: [
                    "24H, 7D, 30D, 90D y All Time cambian la lectura del rendimiento.",
                    "El gráfico principal ya no es de mercado; es de performance del portfolio.",
                  ],
                })}
              >
                Filtrar
              </button>
              <button
                type="button"
                className="ui-button"
                onClick={() => setActiveRange("24h")}
              >
                Reset
              </button>
            </div>
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
                      <div className="card-subtitle">{tabSummary.chartSubtitle} · ventana {getRangeLabel(activeRange)}</div>
                    </div>
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-dot portfolio" />
                        Portfolio
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot benchmark" />
                        Benchmark
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
                <div className="dashboard-panel-head">
                  <div>
                    <div className="dashboard-panel-kicker">Context panel</div>
                    <h3 className="dashboard-side-title">Temporalidades y filtros</h3>
                  </div>
                </div>
                <div className="timeframe-map compact dashboard-timeframe-card">
                  <div className="timeframe-map-header">
                    <div>
                      <div className="dashboard-card-topline">
                        <div className="timeframe-map-title">Mapa de temporalidades</div>
                      </div>
                      <div className="timeframe-map-subtitle">Referencia rápida del contexto mientras lees el rendimiento del portfolio.</div>
                    </div>
                    <div className="timeframe-map-score">{analysis ? `${analysis.alignmentCount}/${analysis.alignmentTotal}` : "--/--"}</div>
                  </div>
                  <div className="timeframe-map-grid">
                    {props.multiTimeframes.length ? (
                      props.multiTimeframes.map((item) => {
                        const itemTone = item.label === "Comprar" ? "buy" : item.label === "Vender" ? "sell" : "wait";
                        return (
                          <div className={`timeframe-chip ${itemTone}`} key={item.timeframe}>
                            <div className="timeframe-chip-head">
                              <span className="timeframe-chip-label">{item.timeframe}</span>
                              <span className="timeframe-chip-dot" />
                            </div>
                            <div className="timeframe-chip-value">{item.label}</div>
                            <div className="timeframe-chip-note">{item.note}</div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="timeframe-chip wait">
                        <div className="timeframe-chip-head">
                          <span className="timeframe-chip-label">--</span>
                          <span className="timeframe-chip-dot" />
                        </div>
                        <div className="timeframe-chip-value">Esperar</div>
                        <div className="timeframe-chip-note">Cargando contexto</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="dashboard-funnel-list">
                  <div className="dashboard-funnel-row">
                    <span>Capital en ejecución</span>
                    <strong>{formatPrice(deployedCapitalValue)}</strong>
                  </div>
                  <div className="dashboard-funnel-row">
                    <span>% desplegado</span>
                    <strong>{formatPct(deploymentPct)}</strong>
                  </div>
                  <div className="dashboard-funnel-row">
                    <span>Señal actual</span>
                    <strong>{signal?.label || "Esperar"}</strong>
                  </div>
                </div>
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

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "bot-performance", label: "Bot Performance" },
  { id: "capital", label: "Capital" },
  { id: "activity", label: "Recent Activity" },
];

const DASHBOARD_RANGES: Array<{ id: DashboardRange; label: string }> = [
  { id: "24h", label: "24H" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "all", label: "All Time" },
];

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
        chartTitle: "Performance del capital supervisado",
        chartSubtitle: `${input.currentCoin} · ${input.timeframe} como referencia del contexto operativo`,
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
        chartTitle: "Rendimiento del portfolio",
        chartSubtitle: "La curva responde a la temporalidad seleccionada para ver cómo se comporta el capital visible",
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
        chartTitle: "Rendimiento y actividad reciente",
        chartSubtitle: "El gráfico central sigue la ventana elegida y el panel lateral resume alertas y contexto",
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
        chartTitle: "Portfolio performance",
        chartSubtitle: "Curva principal del capital visible de CRYPE con comparación de benchmark",
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

function getRangeLabel(range: DashboardRange) {
  return DASHBOARD_RANGES.find((item) => item.id === range)?.label || "24H";
}

function buildPerformanceSeries(
  candles: Candle[],
  portfolio: PortfolioPayload["portfolio"] | undefined,
  range: DashboardRange,
) {
  const totalValue = Number(portfolio?.totalValue || 0);
  const totalPnl = Number(portfolio?.totalPnl || 0);
  const dayChange = Number(portfolio?.periodChangeValue || 0);
  const safeTotal = totalValue > 0 ? totalValue : 1;
  const source = candles.length ? candles : generateFallbackPerformanceCandles();
  const size = range === "24h"
    ? 12
    : range === "7d"
      ? 18
      : range === "30d"
        ? 24
        : range === "90d"
          ? 28
          : 32;
  const sliced = source.slice(-size);
  const firstClose = sliced[0]?.close || 1;
  const lastClose = sliced.at(-1)?.close || firstClose;
  const benchmarkStart = getRangeStartValue(safeTotal, totalPnl, dayChange, range);
  const portfolioStart = benchmarkStart;
  const benchmarkGrowth = firstClose > 0 ? lastClose / firstClose : 1;

  return sliced.map((candle, index) => {
    const progress = sliced.length > 1 ? index / (sliced.length - 1) : 1;
    const marketRatio = firstClose > 0 ? candle.close / firstClose : 1;
    const benchmark = benchmarkStart * marketRatio;
    const weightedProgress = progress * 0.72 + (marketRatio / Math.max(benchmarkGrowth, 0.0001) - 1) * 0.28 + 0.28;
    const normalizedProgress = Math.min(1.12, Math.max(0, weightedProgress));
    const portfolioValue = portfolioStart + (safeTotal - portfolioStart) * normalizedProgress;

    return {
      label: buildRangePointLabel(range, index, sliced.length),
      portfolio: portfolioValue,
      benchmark,
    };
  });
}

function getRangeStartValue(totalValue: number, totalPnl: number, dayChange: number, range: DashboardRange) {
  if (range === "24h") return Math.max(1, totalValue - dayChange);
  if (range === "7d") return Math.max(1, totalValue - dayChange * 2.4);
  if (range === "30d") return Math.max(1, totalValue - dayChange * 4.8);
  if (range === "90d") return Math.max(1, totalValue - Math.max(dayChange * 6.5, totalPnl * 0.55));
  return Math.max(1, totalValue - Math.max(totalPnl, dayChange * 8));
}

function buildRangePointLabel(range: DashboardRange, index: number, total: number) {
  if (range === "24h") {
    const hour = Math.round((24 / Math.max(1, total - 1)) * index);
    return `${hour}h`;
  }
  if (range === "7d") return `D${index + 1}`;
  if (range === "30d") return `W${Math.max(1, Math.ceil((index + 1) / 4))}`;
  if (range === "90d") return `M${Math.max(1, Math.ceil((index + 1) / 8))}`;
  return `Y${Math.max(1, Math.ceil((index + 1) / 8))}`;
}

function generateFallbackPerformanceCandles(): Candle[] {
  return Array.from({ length: 32 }, (_, index) => {
    const base = 100 + index * 1.8;
    const drift = Math.sin(index / 3) * 3;
    const close = base + drift;
    return {
      time: Date.now() - (32 - index) * 60 * 60 * 1000,
      open: close - 1.6,
      high: close + 2.4,
      low: close - 2.8,
      close,
      volume: 1000 + index * 40,
    };
  });
}
