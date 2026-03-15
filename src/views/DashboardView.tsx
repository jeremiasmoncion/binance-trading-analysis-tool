import { formatPct, formatPrice } from "../lib/format";
import type { Candle, OperationPlan, Signal, TimeframeSignal } from "../types";

interface DashboardViewProps {
  currentCoin: string;
  timeframe: string;
  currentPrice: number;
  signal: Signal | null;
  plan: OperationPlan | null;
  multiTimeframes: TimeframeSignal[];
  candles: Candle[];
  chartRef: React.RefObject<HTMLCanvasElement | null>;
}

export function DashboardView(props: DashboardViewProps) {
  const signal = props.signal;
  const plan = props.plan;
  const tone = signal?.label === "Comprar" ? "buy" : signal?.label === "Vender" ? "sell" : "wait";

  return (
    <div id="dashboardView" className="view-panel active">
      <div className="dashboard-shell">
        <section className={`dashboard-hero ${tone}`}>
          <div className="dashboard-hero-top">
            <div>
              <div className={`dashboard-eyebrow ${tone}`}>{signal?.label || "Esperar"}</div>
              <h1 className="dashboard-headline">{signal?.title || "Esperar confirmación"}</h1>
              <p className="dashboard-subcopy">{signal?.reasons[0] || "Análisis en progreso."}</p>
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
              <div className="dashboard-mini-label">Fuerza</div>
              <div className="dashboard-mini-value">{signal ? `${signal.score}%` : "0%"}</div>
              <div className="dashboard-mini-note">Convicción de la lectura actual.</div>
            </div>
            <div className="dashboard-mini-card">
              <div className="dashboard-mini-label">Tendencia</div>
              <div className="dashboard-mini-value">{signal?.trend || "Neutral"}</div>
              <div className="dashboard-mini-note">Sesgo técnico dominante.</div>
            </div>
            <div className="dashboard-mini-card">
              <div className="dashboard-mini-label">Marco activo</div>
              <div className="dashboard-mini-value">{props.timeframe}</div>
              <div className="dashboard-mini-note">Temporalidad desde la que se calcula el plan.</div>
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
                  <div className="card-subtitle">Solo se priorizan señales de alta probabilidad.</div>
                </div>
                <span className="plan-chip">Basado en señal + temporalidad + comisión</span>
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
                  <div className="plan-label">Confianza</div>
                  <div className="plan-value">{signal ? `${signal.score}%` : "0%"}</div>
                  <div className="plan-note">{signal?.trend === "Neutral" ? "Mercado sin sesgo claro" : `Sesgo ${signal?.trend?.toLowerCase() || "neutral"}`}</div>
                </div>
                <div className="plan-item tp">
                  <div className="plan-label">Take profit</div>
                  <div className="plan-value">{formatPrice(plan?.tp || 0)}</div>
                  <div className="plan-note">Objetivo prudente</div>
                </div>
                <div className="plan-item sl">
                  <div className="plan-label">Stop loss</div>
                  <div className="plan-value">{formatPrice(plan?.sl || 0)}</div>
                  <div className="plan-note">Protección sugerida</div>
                </div>
                <div className="plan-item benefit">
                  <div className="plan-label">Riesgo</div>
                  <div className="plan-value">{formatPct(plan?.riskPct || 0)}</div>
                  <div className="plan-note">Aprox. {formatPrice(plan?.riskAmt || 0)}</div>
                </div>
                <div className="plan-item benefit wide">
                  <div className="plan-label">Beneficio posible</div>
                  <div className="plan-value">{formatPct(plan?.benefitPct || 0)}</div>
                  <div className="plan-note">Posible neto aprox. {formatPrice(plan?.benefitAmt || 0)}</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
