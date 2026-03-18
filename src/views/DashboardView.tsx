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
  BinanceTradeSummary,
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
import { drawBotComparisonChart, drawPerformanceChart } from "../lib/chart";

interface DashboardViewProps {
  theme: "light" | "dark";
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

type DashboardTab = "overview" | "bot-performance" | "recent-trades";
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
  const recentTrades = useMemo(
    () => buildRecentTradesRows(props.portfolioData?.recentTrades || [], recentExecuteOrders),
    [props.portfolioData?.recentTrades, recentExecuteOrders],
  );
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
  const botComparisonBars = useMemo(
    () => buildBotComparisonBars(recentExecuteOrders, props.strategy, props.strategyCandidates, activeRange),
    [activeRange, props.strategy, props.strategyCandidates, recentExecuteOrders],
  );
  useEffect(() => {
    if (activeTab === "recent-trades") return;
    if (activeTab === "bot-performance") {
      drawBotComparisonChart(props.chartRef.current, botComparisonBars, props.theme === "dark");
      return;
    }
    drawPerformanceChart(props.chartRef.current, performancePoints, props.theme === "dark");
  }, [activeTab, botComparisonBars, performancePoints, props.chartRef, props.theme]);

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

          {activeTab !== "recent-trades" ? (
            <div className="dashboard-filter-card">
              <div className="dashboard-filter-group">
                <span className="dashboard-filter-label">Range</span>
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
                    title: "Dashboard filters",
                    body: "Controla el rango visible del grafico principal.",
                    bullets: [
                      "Cada rango cambia la lectura del chart.",
                      "El chart principal sigue el rendimiento del portfolio.",
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
          ) : null}

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

            {activeTab === "recent-trades" ? (
              <div className="dashboard-trades-shell">
                <div className="dashboard-trades-card">
                  <div className="ui-data-header dashboard-trades-header">
                    <div className="ui-data-title-block">
                      <h3 className="dashboard-side-title">Recent trades</h3>
                      <p className="dashboard-panel-subtitle">Last 5 account trades for quick review.</p>
                    </div>
                    <button type="button" className="ui-button" onClick={props.onSaveSignal}>
                      <DownloadIcon />
                      Export
                    </button>
                  </div>

                  {!recentTrades.length ? (
                    <div className="dashboard-empty-state">No recent account trades yet.</div>
                  ) : (
                    <div className="ui-table-shell dashboard-trades-table-shell">
                      <table className="ui-table dashboard-trades-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Pair</th>
                            <th>Side</th>
                            <th>Price</th>
                            <th>Amount</th>
                            <th>Total</th>
                            <th>PnL</th>
                            <th>Bot</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentTrades.map((trade) => (
                            <tr key={trade.id}>
                              <td>{trade.timeLabel}</td>
                              <td>
                                <strong className="dashboard-trade-pair">{trade.pair}</strong>
                              </td>
                              <td>
                                <span className={`dashboard-trade-side ${trade.sideTone}`}>{trade.side}</span>
                              </td>
                              <td>{formatPrice(trade.price)}</td>
                              <td>{trade.qtyLabel}</td>
                              <td>{formatPrice(trade.total)}</td>
                              <td>
                                <span className={`dashboard-trade-pnl ${trade.pnlTone}`}>{trade.pnlLabel}</span>
                              </td>
                              <td>
                                <span className="dashboard-trade-bot">{trade.botLabel}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
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
                      {activeTab === "bot-performance" ? (
                        <button type="button" className="ui-button" onClick={props.onSaveSignal}>
                          <DownloadIcon />
                          Export
                        </button>
                      ) : (
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
                      )}
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
                  {activeTab === "bot-performance" ? (
                    <>
                      <div className="dashboard-panel-head">
                        <div>
                          <div className="dashboard-panel-kicker">Ranking</div>
                          <h3 className="dashboard-side-title">Bot ranking</h3>
                        </div>
                      </div>
                      <div className="dashboard-ranking-list">
                        {botComparisonBars.map((item) => (
                          <article key={item.label} className="dashboard-ranking-item">
                            <div className="dashboard-ranking-head">
                              <strong>{item.label}</strong>
                              <span className={item.tone}>{formatSignedPrice(item.value)}</span>
                            </div>
                            <div className="dashboard-ranking-track">
                              <div
                                className={`dashboard-ranking-fill ${item.tone}`}
                                style={{ width: `${getComparisonBarWidth(item.value, botComparisonBars)}%` }}
                              />
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="dashboard-panel-head">
                        <div>
                          <div className="dashboard-panel-kicker">Context</div>
                          <h3 className="dashboard-side-title">Timeframes</h3>
                        </div>
                      </div>
                      <div className="timeframe-map compact dashboard-timeframe-card">
                        <div className="timeframe-map-header">
                          <div>
                            <div className="dashboard-card-topline">
                              <div className="timeframe-map-title">Timeframe map</div>
                            </div>
                            <div className="timeframe-map-subtitle">Quick read of the current setup context.</div>
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
                    </>
                  )}
                </aside>
              </div>
            )}
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
  { id: "recent-trades", label: "Recent Trades" },
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
        title: "Bot performance",
        subtitle: "Rendimiento reciente y capacidad operativa.",
        chartTitle: "Bot performance comparison",
        chartSubtitle: `${input.currentCoin} · ${input.timeframe} context`,
        helpBody: "Compara rendimiento reciente entre bots y capacidad operativa.",
        helpBullets: [
          "Recent bot returns.",
          "Available execution capacity.",
          "Eligible vs blocked flow.",
        ],
        metrics: [
          { label: "P&L bots 24h", value: formatSignedPrice(input.botGeneratedPnl24h), note: "Resultado cerrado reciente", tone: getSignedTone(input.botGeneratedPnl24h) },
          { label: "Win rate", value: formatPct(input.botWinRate24h), note: "Cierres recientes del bot" },
          { label: "Elegibles", value: String(input.eligibleCount), note: "Setups que sí pasan filtros" },
          { label: "Bloqueados", value: String(input.blockedCount), note: "Setups rechazados por edge guard" },
        ],
      };
    case "recent-trades":
      return {
        kicker: "Recent trades",
        title: "Recent trades",
        subtitle: "Last account trades for quick review.",
        chartTitle: "",
        chartSubtitle: "",
        helpBody: "Shows the last 5 account trades without pagination.",
        helpBullets: [
          "Latest account activity.",
          "Fast pnl read.",
          "Quick bot attribution.",
        ],
        metrics: [
          { label: "Recent trades", value: String(input.recentOrdersCount), note: "Quick account view" },
          { label: "Auto left", value: String(input.executionAccount?.autoExecutionRemaining ?? 0), note: "Available today" },
          { label: "Loss streak", value: String(input.executionAccount?.recentLossStreak ?? 0), note: "Under watch" },
          { label: "Daily loss", value: `${Number(input.executionAccount?.dailyLossPct || 0).toFixed(2)}%`, note: "Risk usage" },
        ],
      };
    case "overview":
    default:
      return {
        kicker: "Overview",
        title: "Platform overview",
        subtitle: "Main portfolio view with benchmark.",
        chartTitle: "Portfolio performance",
        chartSubtitle: "Main capital curve with benchmark",
        helpBody: "Quick view of portfolio, deployment and bot output.",
        helpBullets: [
          "Total portfolio.",
          "Capital deployed.",
          "Recent bot output.",
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

function buildBotComparisonBars(
  orders: ExecutionOrderRecord[],
  activeStrategy: StrategyDescriptor,
  candidates: StrategyCandidate[],
  range: DashboardRange,
) {
  const cutoff = getRangeCutoff(range);
  const filtered = orders.filter((item) => {
    const source = item.closed_at || item.last_synced_at || item.created_at;
    if (!source) return false;
    if (!cutoff) return true;
    return new Date(source).getTime() >= cutoff;
  });

  const grouped = new Map<string, number>();
  filtered.forEach((item) => {
    const key = String(item.strategy_name || "Signal Bot Core").trim() || "Signal Bot Core";
    grouped.set(key, Number(grouped.get(key) || 0) + Number(item.realized_pnl || 0));
  });

  const fallbackLabels = [
    activeStrategy.label,
    ...candidates.map((item) => item.strategy.label),
    "Signal Bot Core",
  ];

  fallbackLabels.forEach((label) => {
    if (!grouped.has(label) && grouped.size < 5) {
      grouped.set(label, 0);
    }
  });

  return Array.from(grouped.entries())
    .slice(0, 5)
    .map(([label, value]) => ({
      label,
      value,
      tone: value > 0 ? "positive" as const : value < 0 ? "negative" as const : "neutral" as const,
    }));
}

function getRangeCutoff(range: DashboardRange) {
  const now = Date.now();
  if (range === "24h") return now - 24 * 60 * 60 * 1000;
  if (range === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (range === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  if (range === "90d") return now - 90 * 24 * 60 * 60 * 1000;
  return null;
}

function getComparisonBarWidth(value: number, bars: Array<{ value: number }>) {
  const maxValue = Math.max(...bars.map((item) => Math.abs(item.value)), 1);
  return (Math.abs(value) / maxValue) * 100;
}

interface DashboardRecentTradeRow {
  id: string;
  timeLabel: string;
  pair: string;
  side: "BUY" | "SELL";
  sideTone: "buy" | "sell";
  price: number;
  total: number;
  qtyLabel: string;
  pnlLabel: string;
  pnlTone: "positive" | "negative" | "neutral";
  botLabel: string;
}

function buildRecentTradesRows(
  trades: BinanceTradeSummary[],
  orders: ExecutionOrderRecord[],
): DashboardRecentTradeRow[] {
  if (trades.length) {
    return [...trades]
      .sort((a, b) => (b.time || 0) - (a.time || 0))
      .slice(0, 5)
      .map((trade, index) => {
        const pnl = Number(trade.realizedPnl || 0);
        return {
          id: `${trade.orderId || trade.time || index}-${trade.symbol}-${trade.side}`,
          timeLabel: formatTradeTime(trade.time),
          pair: trade.symbol,
          side: trade.side,
          sideTone: trade.side === "BUY" ? "buy" : "sell",
          price: Number(trade.price || 0),
          total: Number(trade.value || Number(trade.qty || 0) * Number(trade.price || 0)),
          qtyLabel: formatTradeQty(trade.qty),
          pnlLabel: formatSignedPrice(pnl),
          pnlTone: getSignedTone(pnl),
          botLabel: getTradeOriginLabel(trade.originLabel, trade.sourceType),
        };
      });
  }

  return [...orders]
    .sort((a, b) => new Date(b.closed_at || b.created_at).getTime() - new Date(a.closed_at || a.created_at).getTime())
    .slice(0, 5)
    .map((order) => {
      const pnl = Number(order.realized_pnl || 0);
      const qty = Number(order.quantity || 0);
      const price = Number(order.current_price || 0);
      const total = Number(order.notional_usd || qty * price);
      const side = String(order.side).toUpperCase() === "SELL" ? "SELL" : "BUY";
      return {
        id: String(order.id),
        timeLabel: formatTradeTime(order.closed_at || order.created_at),
        pair: order.coin ? `${order.coin}/USDT` : "--",
        side,
        sideTone: side === "SELL" ? "sell" : "buy",
        price,
        total,
        qtyLabel: formatTradeQty(qty),
        pnlLabel: formatSignedPrice(pnl),
        pnlTone: getSignedTone(pnl),
        botLabel: getTradeOriginLabel(order.strategy_name, order.origin),
      };
    });
}

function formatTradeTime(value: number | string | undefined) {
  if (!value) return "--";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatTradeQty(value: number | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "--";
  return amount >= 1 ? amount.toLocaleString(undefined, { maximumFractionDigits: 3 }) : amount.toFixed(4);
}

function getTradeOriginLabel(originLabel?: string, sourceType?: string) {
  const raw = String(originLabel || sourceType || "").trim().toLowerCase();
  if (!raw) return "Manual";
  if (raw.includes("signal")) return "Signal Bot";
  if (raw.includes("dca")) return "DCA Bot";
  if (raw.includes("grid")) return "Grid Bot";
  if (raw.includes("manual")) return "Manual";
  return String(originLabel || sourceType || "Bot")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
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
