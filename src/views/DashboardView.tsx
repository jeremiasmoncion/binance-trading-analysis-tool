import { HelpCircleIcon } from "../components/Icons";
import { formatPct, formatPrice, formatSignedPct } from "../lib/format";
import type { Candle, DashboardAnalysis, OperationPlan, Signal, StrategyCandidate, StrategyDescriptor, TimeframeSignal } from "../types";
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
  onSaveSignal: () => void;
}

export function DashboardView(props: DashboardViewProps) {
  const signal = props.signal;
  const plan = props.plan;
  const analysis = props.analysis;
  const tone = signal?.label === "Comprar" ? "buy" : signal?.label === "Vender" ? "sell" : "wait";

  return (
    <div id="dashboardView" className="view-panel active">
      <div className="dashboard-shell">
        <section className={`dashboard-hero ${tone}`}>
          <div className="dashboard-hero-top">
            <div>
              <div className="dashboard-active-coin">
                {props.currentCoin}
                <DashboardHelpButton
                  title="Lectura principal del activo"
                  body="Este bloque resume la lectura actual del par seleccionado. Aquí ves la señal dominante, el estilo operativo de la estrategia activa y el contexto general antes de mirar el plan sugerido."
                  bullets={[
                    "La etiqueta Comprar / Vender / Esperar es la decisión dominante actual.",
                    "Los chips te dicen qué estrategia mandó, qué estilo de trading usa y qué contexto está viendo.",
                    "El precio a la derecha es la referencia viva del activo que estás siguiendo.",
                  ]}
                  footer="La idea es que este bloque te dé la foto general en segundos."
                />
              </div>
              <div className={`dashboard-eyebrow ${tone}`}>{signal?.label || "Esperar"}</div>
              <h1 className="dashboard-headline">{signal?.title || "Esperar confirmación"}</h1>
              <p className="dashboard-subcopy">{signal?.reasons[0] || "Análisis en progreso."}</p>
              <div className="dashboard-chip-row">
                <span className="dashboard-chip">{props.strategy.label}</span>
                <span className="dashboard-chip">{getFriendlyTradingStyle(props.strategy.tradingStyle)}</span>
                <span className="dashboard-chip">{analysis?.alignmentLabel || "Sin contexto"}</span>
                <span className="dashboard-chip">{analysis?.setupType || "Setup pendiente"}</span>
                <span className="dashboard-chip">{analysis?.volatilityLabel ? `Volatilidad ${analysis.volatilityLabel.toLowerCase()}` : "Volatilidad pendiente"}</span>
              </div>
            </div>
            <div className="dashboard-pulse">
              <div className="dashboard-pulse-label">Activo en seguimiento</div>
              <div className="dashboard-pulse-value">{formatPrice(props.currentPrice || 0)}</div>
              <div className="dashboard-pulse-note">Precio actual del par seleccionado con la temporalidad que tienes activa.</div>
            </div>
          </div>

          <div className="dashboard-summary-grid">
            <div className="dashboard-mini-card">
              <div className="dashboard-card-topline">
                <div className="dashboard-mini-label">Señal dominante</div>
                <DashboardHelpButton
                  title="Señal dominante"
                  body="Es la lectura principal que el motor considera más fuerte ahora mismo. No es una orden automática por sí sola: es la mejor lectura técnica disponible en este instante."
                />
              </div>
              <div className="dashboard-mini-value">{signal?.title || "Esperar, pero con sesgo neutral"}</div>
              <div className="dashboard-mini-note">Lectura principal del mercado ahora mismo.</div>
            </div>
            <div className="dashboard-mini-card">
              <div className="dashboard-card-topline">
                <div className="dashboard-mini-label">Convicción</div>
                <DashboardHelpButton
                  title="Convicción"
                  body="La convicción mide qué tan fuerte se siente la lectura actual según alineación, volumen, contexto y estructura. Más alta no significa garantía; significa que la señal tiene más respaldo técnico."
                />
              </div>
              <div className="dashboard-mini-value">{signal ? `${signal.score}%` : "0%"}</div>
              <div className="dashboard-mini-note">{analysis ? `${analysis.setupQuality} · Riesgo ${analysis.riskLabel.toLowerCase()}` : "Convicción de la lectura actual."}</div>
            </div>
            <div className="dashboard-mini-card">
              <div className="dashboard-card-topline">
                <div className="dashboard-mini-label">Marco mayor</div>
                <DashboardHelpButton
                  title="Marco mayor"
                  body="Aquí ves el sesgo dominante en temporalidades más altas. Sirve para saber si la señal actual va a favor del contexto grande o si está intentando ir contra corriente."
                />
              </div>
              <div className="dashboard-mini-value">{analysis?.higherTimeframeBias || signal?.trend || "Neutral"}</div>
              <div className="dashboard-mini-note">{analysis ? `${analysis.alignmentCount}/${analysis.alignmentTotal} temporalidades alineadas` : "Sesgo técnico dominante."}</div>
            </div>
            <div className="dashboard-mini-card">
              <div className="dashboard-card-topline">
                <div className="dashboard-mini-label">Niveles</div>
                <DashboardHelpButton
                  title="Distancia a niveles"
                  body="Te muestra qué tan cerca está el precio actual del soporte y de la resistencia. Sirve para saber si la entrada está relativamente cómoda o si ya está muy cerca de una zona peligrosa."
                />
              </div>
              <div className="dashboard-mini-value">{analysis ? `${formatPct(analysis.supportDistancePct)} / ${formatPct(analysis.resistanceDistancePct)}` : "--"}</div>
              <div className="dashboard-mini-note">Distancia a soporte y resistencia.</div>
            </div>
          </div>
        </section>

        <div className="dashboard-main-grid">
          <div className="dashboard-stack">
            <div className="timeframe-map">
              <div className="timeframe-map-header">
                <div>
                  <div className="dashboard-card-topline">
                    <div className="timeframe-map-title">Mapa de temporalidades</div>
                    <DashboardHelpButton
                      title="Mapa de temporalidades"
                      body="Aquí el sistema compara varios marcos de tiempo para ver si el impulso está alineado o mezclado. Cuantas más temporalidades apoyan la misma idea, más sólida suele sentirse la lectura."
                      bullets={[
                        "Verde o compra: impulso favorable.",
                        "Rojo o venta: presión bajista dominante.",
                        "Amarillo o espera: contexto mixto o sin confirmación suficiente.",
                      ]}
                    />
                  </div>
                  <div className="timeframe-map-subtitle">Confirma si el impulso está alineado antes de entrar.</div>
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

            <div className="analysis-grid">
              <div className="analysis-card strategy-engine-card">
                <div className="dashboard-card-topline">
                  <div className="analysis-card-label">Motor de estrategias</div>
                  <DashboardHelpButton
                    title="Motor de estrategias"
                    body="Aquí ves cuál estrategia ganó la competencia interna del sistema y cuáles quedaron como alternativas. El motor compara varias lecturas y elige la principal antes de armar la señal final."
                    bullets={[
                      "Activa: la estrategia que manda ahora mismo.",
                      "Alternativas: ideas que compitieron pero no ganaron.",
                      "Ritmo del motor: cada cuánto esta familia suele revisarse.",
                    ]}
                  />
                </div>
                <div className="analysis-card-value">{props.strategy.label}</div>
                <div className="analysis-card-note">{props.strategy.description}</div>
                <div className="strategy-candidate-meta">
                  Mejor en {props.strategy.preferredTimeframes.join(" / ")} · {getFriendlyTradingStyle(props.strategy.tradingStyle)} · Perfil {props.strategy.holdingProfile || "mixto"}
                </div>
                <div className="strategy-candidate-meta">
                  Contexto ideal: {props.strategy.idealMarketConditions.join(", ")}
                </div>
                <div className="strategy-candidate-meta">
                  Ritmo del motor: {props.strategy.schedulerLabel || "revisión adaptable"} · cada {formatSchedulerInterval(props.strategyRefreshIntervalMs)}
                </div>
                <div className="strategy-candidate-list">
                  {props.strategyCandidates.slice(0, 3).map((candidate) => (
                    <div key={`${candidate.strategy.id}-${candidate.strategy.version}`} className={`strategy-candidate ${candidate.isPrimary ? "is-primary" : ""}`}>
                      <div className="strategy-candidate-name">
                        {candidate.strategy.label}
                        {candidate.isPrimary ? <span className="strategy-candidate-badge">Activa</span> : null}
                      </div>
                      <div className="strategy-candidate-meta">
                        {candidate.signal.label} · {candidate.signal.score}% · {candidate.analysis.setupType} · {getFriendlyTradingStyle(candidate.strategy.tradingStyle)}
                      </div>
                      <div className="strategy-candidate-meta">
                        Marcos: {candidate.strategy.preferredTimeframes.join(" / ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="analysis-card">
                <div className="dashboard-card-topline">
                  <div className="analysis-card-label">Calidad del setup</div>
                  <DashboardHelpButton
                    title="Calidad del setup"
                    body="Resume qué tan limpio se siente el patrón de entrada actual. No habla del resultado futuro, sino de si la estructura técnica se ve ordenada o agresiva."
                  />
                </div>
                <div className="analysis-card-value">{analysis?.setupQuality || "Media"}</div>
                <div className="analysis-card-note">{analysis?.setupType || "Esperando contexto más limpio"}</div>
              </div>
              <div className="analysis-card">
                <div className="dashboard-card-topline">
                  <div className="analysis-card-label">Volumen</div>
                  <DashboardHelpButton
                    title="Volumen"
                    body="Compara la participación actual con el promedio reciente. Un movimiento con volumen débil suele inspirar menos confianza que uno que viene acompañado por más actividad."
                  />
                </div>
                <div className="analysis-card-value">{analysis?.volumeLabel || "Normal"}</div>
                <div className="analysis-card-note">{analysis ? `${analysis.volumeRatio}x vs promedio reciente` : "Sin lectura"}</div>
              </div>
              <div className="analysis-card">
                <div className="dashboard-card-topline">
                  <div className="analysis-card-label">Volatilidad</div>
                  <DashboardHelpButton
                    title="Volatilidad"
                    body="Te dice qué tan brusco está el movimiento reciente. Mucha volatilidad puede dar más oportunidad, pero también exige más cuidado con el stop y el tamaño de posición."
                  />
                </div>
                <div className="analysis-card-value">{analysis?.volatilityLabel || "Media"}</div>
                <div className="analysis-card-note">{analysis ? `${formatPct(analysis.volatilityPct)} ATR aprox.` : "Sin lectura"}</div>
              </div>
              <div className="analysis-card">
                <div className="dashboard-card-topline">
                  <div className="analysis-card-label">Riesgo del setup</div>
                  <DashboardHelpButton
                    title="Riesgo del setup"
                    body="Resume cuánto cuidado exige esta oportunidad según rango, niveles y contexto. Un setup agresivo puede seguir siendo válido, pero requiere más disciplina."
                  />
                </div>
                <div className="analysis-card-value">{analysis?.riskLabel || "Controlado"}</div>
                <div className="analysis-card-note">{analysis ? `Precio en ${formatPct(analysis.rangePositionPct)} del rango reciente` : "Sin lectura"}</div>
              </div>
            </div>

            <div className="levels-card">
              <div className="card-header">
                <div>
                  <div className="card-title">Niveles y contexto</div>
                  <div className="card-subtitle">Soporte, resistencia y checklist rápido para validar la señal.</div>
                </div>
                <div className="card-header-actions">
                  <DashboardHelpButton
                    title="Niveles y contexto"
                    body="Este bloque reúne los niveles técnicos clave y las advertencias rápidas antes de operar. Úsalo para detectar si la entrada está bien ubicada o demasiado expuesta."
                    bullets={[
                      "Soporte: zona donde el precio podría defenderse.",
                      "Resistencia: zona donde el avance podría frenarse.",
                      "Confirmaciones y advertencias: resumen rápido de lo que apoya o complica la idea.",
                    ]}
                  />
                </div>
              </div>
              <div className="levels-grid">
                <div className="level-pill">
                  <span className="level-pill-label">Soporte</span>
                  <strong>{formatPrice(analysis?.support || 0)}</strong>
                  <span>{analysis ? `${formatPct(analysis.supportDistancePct)} debajo del precio` : "Sin lectura"}</span>
                </div>
                <div className="level-pill">
                  <span className="level-pill-label">Resistencia</span>
                  <strong>{formatPrice(analysis?.resistance || 0)}</strong>
                  <span>{analysis ? `${formatPct(analysis.resistanceDistancePct)} arriba del precio` : "Sin lectura"}</span>
                </div>
                <div className="level-pill">
                  <span className="level-pill-label">Marco mayor</span>
                  <strong>{analysis?.higherTimeframeBias || "Mixto"}</strong>
                  <span>{analysis?.alignmentLabel || "Sin contexto"}</span>
                </div>
              </div>
              <div className="checklist-grid">
                <div className="checklist-card">
                  <div className="checklist-title">Confirmaciones</div>
                  <ul>
                    {(analysis?.confirmations?.length ? analysis.confirmations : ["Esperando confirmaciones más claras"]).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="checklist-card warnings">
                  <div className="checklist-title">Advertencias</div>
                  <ul>
                    {(analysis?.warnings?.length ? analysis.warnings : ["No vemos alertas técnicas fuertes"]).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="chart-container">
              <div className="chart-header">
                <div>
                  <div className="dashboard-card-topline">
                    <div className="chart-title">Gráfico de velas {props.currentCoin}</div>
                    <DashboardHelpButton
                      title="Gráfico principal"
                      body="Aquí ves el precio, las velas y las medias para validar visualmente lo que el sistema te está diciendo. Es el mejor lugar para confirmar si la narrativa de la señal se siente coherente."
                    />
                  </div>
                  <div className="card-subtitle">Te ayuda a ver si el precio está empujando al alza, frenándose o cayendo.</div>
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-dot green" />
                    Vela alcista
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot red" />
                    Vela bajista
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot blue" />
                    Media corta
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot orange" />
                    Media larga
                  </div>
                </div>
              </div>
              <canvas ref={props.chartRef} />
            </div>
          </div>

          <aside className="dashboard-stack">
            <div className="quick-plan">
              <div className="quick-plan-header">
                <div>
                  <div className="dashboard-card-topline">
                    <div className="quick-plan-title">Plan rápido sugerido</div>
                    <DashboardHelpButton
                      title="Plan rápido sugerido"
                      body="Este bloque traduce la lectura del sistema a una propuesta operativa. Resume entrada, objetivos, invalidación y riesgo para que puedas decidir si vale la pena actuar."
                      bullets={[
                        "Entrada: precio técnico de referencia.",
                        "TP1 / TP2: objetivos sugeridos.",
                        "Stop loss: punto donde la idea deja de tener sentido.",
                        "RR estimado: relación riesgo / beneficio de la propuesta.",
                      ]}
                    />
                  </div>
                  <div className="card-subtitle">Plan técnico basado en alineación, niveles, volatilidad y costo operativo.</div>
                </div>
                <div className="inline-actions">
                  <span className="plan-chip">{analysis?.setupType || "Basado en señal + temporalidad + comisión"}</span>
                  <span className="plan-chip">{props.strategy.version}</span>
                  <button className="btn-secondary-soft" type="button" onClick={props.onSaveSignal}>
                    Guardar señal
                  </button>
                </div>
              </div>
              <div className="plan-signal-wrap">
                <span className={`plan-signal-pill ${tone}`}>Señal: {signal?.label || "Esperar"}</span>
              </div>
              <div className="quick-plan-grid">
                <div className="plan-item entry">
                  <div className="plan-label">Entrada sugerida</div>
                  <div className="plan-value">{formatPrice(plan?.entry || 0)}</div>
                  <div className="plan-note">Referencia técnica</div>
                </div>
                <div className="plan-item risk">
                  <div className="plan-label">Convicción</div>
                  <div className="plan-value">{signal ? `${signal.score}%` : "0%"}</div>
                  <div className="plan-note">{analysis ? `${analysis.setupQuality} · ${analysis.volumeLabel.toLowerCase()}` : (signal?.trend === "Neutral" ? "Mercado sin sesgo claro" : `Sesgo ${signal?.trend?.toLowerCase() || "neutral"}`)}</div>
                </div>
                <div className="plan-item tp">
                  <div className="plan-label">Take profit 1</div>
                  <div className="plan-value">{formatPrice(plan?.tp || 0)}</div>
                  <div className="plan-note">Objetivo prudente</div>
                </div>
                <div className="plan-item sl">
                  <div className="plan-label">Stop loss</div>
                  <div className="plan-value">{formatPrice(plan?.sl || 0)}</div>
                  <div className="plan-note">Invalidación técnica</div>
                </div>
                <div className="plan-item benefit">
                  <div className="plan-label">Riesgo</div>
                  <div className="plan-value">{formatPct(plan?.riskPct || 0)}</div>
                  <div className="plan-note">Aprox. {formatPrice(plan?.riskAmt || 0)}</div>
                </div>
                <div className="plan-item entry">
                  <div className="plan-label">Take profit 2</div>
                  <div className="plan-value">{formatPrice(plan?.tp2 || 0)}</div>
                  <div className="plan-note">Extensión si el impulso sigue</div>
                </div>
                <div className="plan-item benefit">
                  <div className="plan-label">RR estimado</div>
                  <div className="plan-value">{plan?.rrRatio ? `${plan.rrRatio}:1` : "0:1"}</div>
                  <div className="plan-note">{analysis?.riskLabel ? `Setup ${analysis.riskLabel.toLowerCase()}` : "Relación riesgo/beneficio"}</div>
                </div>
                <div className="plan-item benefit wide">
                  <div className="plan-label">Beneficio posible</div>
                  <div className="plan-value">{formatPct(plan?.benefitPct || 0)}</div>
                  <div className="plan-note">Posible neto aprox. {formatPrice(plan?.benefitAmt || 0)} · {analysis ? `Cambio del período ${formatSignedPct(analysis.rangePositionPct - 50)}` : ""}</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
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
  const minutes = Math.round(intervalMs / 60000);
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  }
  return `${minutes}m`;
}
