import { formatPct, formatPrice, formatSignedPct } from "../lib/format";
import type { Candle, DashboardAnalysis, OperationPlan, Signal, StrategyDescriptor, TimeframeSignal } from "../types";

interface DashboardViewProps {
  currentCoin: string;
  timeframe: string;
  currentPrice: number;
  signal: Signal | null;
  plan: OperationPlan | null;
  analysis: DashboardAnalysis | null;
  strategy: StrategyDescriptor;
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
              <div className="dashboard-active-coin">{props.currentCoin}</div>
              <div className={`dashboard-eyebrow ${tone}`}>{signal?.label || "Esperar"}</div>
              <h1 className="dashboard-headline">{signal?.title || "Esperar confirmación"}</h1>
              <p className="dashboard-subcopy">{signal?.reasons[0] || "Análisis en progreso."}</p>
              <div className="dashboard-chip-row">
                <span className="dashboard-chip">{props.strategy.label}</span>
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
              <div className="dashboard-mini-label">Señal dominante</div>
              <div className="dashboard-mini-value">{signal?.title || "Esperar, pero con sesgo neutral"}</div>
              <div className="dashboard-mini-note">Lectura principal del mercado ahora mismo.</div>
            </div>
            <div className="dashboard-mini-card">
              <div className="dashboard-mini-label">Convicción</div>
              <div className="dashboard-mini-value">{signal ? `${signal.score}%` : "0%"}</div>
              <div className="dashboard-mini-note">{analysis ? `${analysis.setupQuality} · Riesgo ${analysis.riskLabel.toLowerCase()}` : "Convicción de la lectura actual."}</div>
            </div>
            <div className="dashboard-mini-card">
              <div className="dashboard-mini-label">Marco mayor</div>
              <div className="dashboard-mini-value">{analysis?.higherTimeframeBias || signal?.trend || "Neutral"}</div>
              <div className="dashboard-mini-note">{analysis ? `${analysis.alignmentCount}/${analysis.alignmentTotal} temporalidades alineadas` : "Sesgo técnico dominante."}</div>
            </div>
            <div className="dashboard-mini-card">
              <div className="dashboard-mini-label">Niveles</div>
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
                  <div className="timeframe-map-title">Mapa de temporalidades</div>
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
              <div className="analysis-card">
                <div className="analysis-card-label">Calidad del setup</div>
                <div className="analysis-card-value">{analysis?.setupQuality || "Media"}</div>
                <div className="analysis-card-note">{analysis?.setupType || "Esperando contexto más limpio"}</div>
              </div>
              <div className="analysis-card">
                <div className="analysis-card-label">Volumen</div>
                <div className="analysis-card-value">{analysis?.volumeLabel || "Normal"}</div>
                <div className="analysis-card-note">{analysis ? `${analysis.volumeRatio}x vs promedio reciente` : "Sin lectura"}</div>
              </div>
              <div className="analysis-card">
                <div className="analysis-card-label">Volatilidad</div>
                <div className="analysis-card-value">{analysis?.volatilityLabel || "Media"}</div>
                <div className="analysis-card-note">{analysis ? `${formatPct(analysis.volatilityPct)} ATR aprox.` : "Sin lectura"}</div>
              </div>
              <div className="analysis-card">
                <div className="analysis-card-label">Riesgo del setup</div>
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
                  <div className="chart-title">Gráfico de velas {props.currentCoin}</div>
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
                  <div className="quick-plan-title">Plan rápido sugerido</div>
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
