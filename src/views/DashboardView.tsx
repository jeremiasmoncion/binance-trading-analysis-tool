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

export function DashboardView(props: DashboardViewProps) {
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
  const topCandidate = props.strategyCandidates.find((item) => !item.isPrimary) || null;
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

        <section className="dashboard-command-grid ui-insight-layout">
          <div className="dashboard-command-main">
            <div className="dashboard-command-card">
              <div className="dashboard-panel-head">
                <div>
                  <div className="dashboard-panel-kicker">Platform status</div>
                  <h2 className="dashboard-panel-title">Pulso operativo de CRYPE</h2>
                  <p className="dashboard-panel-subtitle">
                    Resumen ejecutivo de capital, bot operativo, capa de ejecución e IA adaptativa usando la base de layout de Wallet.
                  </p>
                </div>
                <DashboardHelpButton
                  title="Pulso operativo"
                  body="Este bloque resume cómo está funcionando la plataforma ahora mismo sin entrar al detalle táctico de cada señal."
                  bullets={[
                    "Capital: cuánto está desplegado y cuánto está líquido.",
                    "Bot: si Signal Bot está operativo y con qué filtros.",
                    "Ejecución: capacidad demo disponible y frenos activos.",
                  ]}
                />
              </div>

              <div className="dashboard-kpi-grid">
                <article className="dashboard-kpi-tile ui-interactive-surface">
                  <span className="dashboard-kpi-label">Capital desplegado</span>
                  <strong className="dashboard-kpi-value">{formatPct(deploymentPct)}</strong>
                  <span className="dashboard-kpi-note">
                    {formatPrice(portfolio?.positionsValue || 0)} en posiciones · caja {formatPct(cashPct)}
                  </span>
                </article>
                <article className="dashboard-kpi-tile ui-interactive-surface">
                  <span className="dashboard-kpi-label">Signal Bot</span>
                  <strong className="dashboard-kpi-value">{executionProfile?.autoExecuteEnabled ? "Auto" : "Assist"}</strong>
                  <span className="dashboard-kpi-note">
                    Filtro base {Math.round(executionProfile?.minSignalScore || 0)} score · RR {Number(executionProfile?.minRrRatio || 0).toFixed(2)}
                  </span>
                </article>
                <article className="dashboard-kpi-tile ui-interactive-surface">
                  <span className="dashboard-kpi-label">Capacidad demo hoy</span>
                  <strong className="dashboard-kpi-value">{String(executionAccount?.autoExecutionRemaining ?? 0)}</strong>
                  <span className="dashboard-kpi-note">
                    {String(executionAccount?.dailyAutoExecutions ?? 0)} usadas de {String(executionProfile?.maxDailyAutoExecutions ?? 0)}
                  </span>
                </article>
                <article className="dashboard-kpi-tile ui-interactive-surface">
                  <span className="dashboard-kpi-label">Market pulse</span>
                  <strong className={`dashboard-kpi-value ${getSignedTone(marketDriftPct)}`}>{formatSignedPct(marketDriftPct)}</strong>
                  <span className="dashboard-kpi-note">
                    {props.currentCoin} · {props.timeframe} · {formatPrice(currentPrice)}
                  </span>
                </article>
              </div>

              <div className="dashboard-signal-grid">
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
            </div>

            <div className="dashboard-command-card">
              <div className="dashboard-panel-head">
                <div>
                  <div className="dashboard-panel-kicker">Bot operations</div>
                  <h2 className="dashboard-panel-title">Actividad reciente del bot</h2>
                  <p className="dashboard-panel-subtitle">
                    El Dashboard observa al bot y su ejecución reciente; el análisis táctico profundo sigue perteneciendo a Signal Bot.
                  </p>
                </div>
                <DashboardHelpButton
                  title="Actividad reciente del bot"
                  body="Aquí solo vemos trazas operativas recientes para entender si el sistema está ejecutando, cerrando y respetando controles."
                />
              </div>

              {!recentOrders.length ? (
                <div className="dashboard-empty-state">
                  Aún no hay ejecuciones demo recientes para mostrar en el centro de mando.
                </div>
              ) : (
                <div className="ui-activity-stack">
                  {recentOrders.map((item) => {
                    const tone = getOrderTone(item);
                    const statusLabel = getOrderStatusLabel(item);
                    const amountLabel = item.realized_pnl != null
                      ? formatSignedPrice(item.realized_pnl)
                      : formatPrice(item.notional_usd || 0);

                    return (
                      <article key={item.id} className="dashboard-activity-item ui-activity-item ui-interactive-surface">
                        <div className="ui-activity-main">
                          <div className={`dashboard-activity-badge ${tone}`}>
                            {tone === "positive" ? <CheckCircleIcon /> : tone === "negative" ? <WarningTriangleIcon /> : <InfoCircleIcon />}
                          </div>
                          <div className="ui-activity-copy">
                            <div className="ui-activity-title">
                              {item.coin || "Signal Bot"} {item.side ? `· ${String(item.side).toUpperCase()}` : ""}
                            </div>
                            <div className="ui-activity-meta">
                              {statusLabel} · {item.strategy_name || props.strategy.label} · {item.timeframe || props.timeframe}
                            </div>
                            <div className="ui-activity-meta">
                              {formatExecutionTime(item)} · modo {item.mode === "execute" ? "demo" : item.mode}
                            </div>
                          </div>
                        </div>
                        <div className="ui-activity-values">
                          <div className={`ui-activity-amount ${tone}`}>{amountLabel}</div>
                          <div className="ui-activity-usd">
                            {item.realized_pnl != null ? "P&L realizado" : `Notional ${formatPrice(item.notional_usd || 0)}`}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="dashboard-command-card">
              <div className="dashboard-panel-head">
                <div>
                  <div className="dashboard-panel-kicker">Intelligence</div>
                  <h2 className="dashboard-panel-title">Lectura de IA y contexto</h2>
                  <p className="dashboard-panel-subtitle">
                    Un resumen compacto del estado del motor, del contexto actual y de qué está priorizando el sistema.
                  </p>
                </div>
                <DashboardHelpButton
                  title="Lectura de IA y contexto"
                  body="Esta parte condensa el estado del motor de estrategias y del mercado sin arrastrar todo el detalle de la pantalla del bot."
                />
              </div>

              <div className="dashboard-intelligence-grid">
                <article className="dashboard-context-card ui-interactive-surface">
                  <div className="dashboard-context-label">Estrategia activa</div>
                  <div className="dashboard-context-value">{props.strategy.label}</div>
                  <div className="dashboard-context-copy">{props.strategy.description}</div>
                  <div className="dashboard-context-meta">
                    {props.strategy.preferredTimeframes.join(" / ")} · {getFriendlyTradingStyle(props.strategy.tradingStyle)}
                  </div>
                </article>

                <article className="dashboard-context-card ui-interactive-surface">
                  <div className="dashboard-context-label">Setup observado</div>
                  <div className="dashboard-context-value">{analysis?.setupQuality || "Media"}</div>
                  <div className="dashboard-context-copy">
                    {analysis?.setupType || "Esperando una estructura de mayor convicción antes de exponer más capital."}
                  </div>
                  <div className="dashboard-context-meta">
                    {signal?.label || "Esperar"} · score {signal?.score ?? 0}% · {analysis?.volumeLabel || "Volumen normal"}
                  </div>
                </article>

                <article className="dashboard-context-card ui-interactive-surface">
                  <div className="dashboard-context-label">Alternativa inmediata</div>
                  <div className="dashboard-context-value">{topCandidate?.strategy.label || "Sin rival claro"}</div>
                  <div className="dashboard-context-copy">
                    {topCandidate
                      ? `${topCandidate.signal.label} · ${topCandidate.analysis.setupType} · ${topCandidate.signal.score}%`
                      : "El motor no tiene otra estrategia compitiendo con fuerza suficiente ahora mismo."}
                  </div>
                  <div className="dashboard-context-meta">
                    Ritmo del motor: cada {formatSchedulerInterval(props.strategyRefreshIntervalMs)}
                  </div>
                </article>
              </div>

              <div className="timeframe-map compact">
                <div className="timeframe-map-header">
                  <div>
                    <div className="dashboard-card-topline">
                      <div className="timeframe-map-title">Mapa de temporalidades</div>
                      <DashboardHelpButton
                        title="Mapa de temporalidades"
                        body="Permite ver si varios marcos apoyan la misma narrativa antes de aumentar convicción operativa."
                      />
                    </div>
                    <div className="timeframe-map-subtitle">Indicador rápido de alineación del mercado para el sistema.</div>
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
            </div>
          </div>

          <aside className="ui-side-stack">
            <div className="dashboard-side-card">
              <div className="dashboard-panel-head">
                <div>
                  <div className="dashboard-panel-kicker">Capital</div>
                  <h2 className="dashboard-panel-title">Estado del capital</h2>
                </div>
                <DashboardHelpButton
                  title="Estado del capital"
                  body="Ayuda a ver si el capital está demasiado expuesto, demasiado ocioso o distribuido de forma sana."
                />
              </div>

              <div className="dashboard-side-metrics">
                <div className="dashboard-side-metric">
                  <span>24h P&amp;L</span>
                  <strong className={getSignedTone(portfolioChangeValue)}>{formatSignedPrice(portfolioChangeValue)}</strong>
                </div>
                <div className="dashboard-side-metric">
                  <span>Open P&amp;L</span>
                  <strong className={getSignedTone(portfolio?.unrealizedPnl || 0)}>{formatSignedPrice(portfolio?.unrealizedPnl || 0)}</strong>
                </div>
                <div className="dashboard-side-metric">
                  <span>Posiciones abiertas</span>
                  <strong>{String(portfolio?.openPositionsCount || 0)}</strong>
                </div>
                <div className="dashboard-side-metric">
                  <span>Ganadoras</span>
                  <strong>{String(portfolio?.winnersCount || 0)}</strong>
                </div>
              </div>
            </div>

            <div className="dashboard-side-card">
              <div className="dashboard-panel-head">
                <div>
                  <div className="dashboard-panel-kicker">Execution</div>
                  <h2 className="dashboard-panel-title">Embudo de ejecución</h2>
                </div>
                <DashboardHelpButton
                  title="Embudo de ejecución"
                  body="Muestra qué tanto del flujo está listo para ejecutar y qué parte se está quedando bloqueada por filtros."
                />
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
                  <span>Daily loss</span>
                  <strong>{Number(executionAccount?.dailyLossPct || 0).toFixed(2)}%</strong>
                </div>
                <div className="dashboard-funnel-row">
                  <span>Racha de pérdidas</span>
                  <strong>{String(executionAccount?.recentLossStreak || 0)}</strong>
                </div>
              </div>
            </div>

            <div className="dashboard-side-card">
              <div className="dashboard-panel-head">
                <div>
                  <div className="dashboard-panel-kicker">Risk desk</div>
                  <h2 className="dashboard-panel-title">Alertas y frenos</h2>
                </div>
                <DashboardHelpButton
                  title="Alertas y frenos"
                  body="Resume lo que hoy pide atención humana para evitar sobreexposición, ruido o baja calidad de edge."
                />
              </div>

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
            </div>
          </aside>
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

function getFriendlyTradingStyle(style: string) {
  if (style === "scalping / intradía") return "Scalping / intradía";
  if (style === "intradía") return "Intradía";
  if (style === "swing corto") return "Swing corto";
  return style || "Sin perfil";
}

function formatSchedulerInterval(intervalMs: number) {
  const minutes = Math.max(1, Math.round(intervalMs / 60000));
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  }
  return `${minutes}m`;
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

function formatExecutionTime(item: ExecutionOrderRecord) {
  const source = item.closed_at || item.last_synced_at || item.created_at;
  if (!source) return "Sin tiempo";
  return new Intl.DateTimeFormat("es-DO", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(source));
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
