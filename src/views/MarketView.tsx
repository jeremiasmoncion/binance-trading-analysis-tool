import { formatPrice } from "../lib/format";
import type { Indicators, Signal } from "../types";

interface MarketViewProps {
  currentCoin: string;
  signal: Signal | null;
  indicators: Indicators | null;
  market24h: {
    change: number;
    high: number;
    low: number;
    volume: string;
    updatedAt: string;
  };
  support: number;
  resistance: number;
}

export function MarketView(props: MarketViewProps) {
  const signal = props.signal;
  const indicators = props.indicators;
  return (
    <div id="marketView" className="view-panel">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Lectura de mercado</div>
            <div className="card-subtitle">Señal principal, indicadores y contexto técnico del activo seleccionado.</div>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Cambio 24h</div>
          <div className={`value ${props.market24h.change >= 0 ? "positive" : "negative"}`}>{props.market24h.change.toFixed(2)}%</div>
          <div className="sub">Variación del día</div>
        </div>
        <div className="stat-card">
          <div className="label">Máximo / Mínimo 24h</div>
          <div className="value">
            {formatPrice(props.market24h.high)} / {formatPrice(props.market24h.low)}
          </div>
          <div className="sub">Rango donde se ha movido hoy</div>
        </div>
        <div className="stat-card">
          <div className="label">Volumen 24h</div>
          <div className="value">{props.market24h.volume}</div>
          <div className="sub">Entre más volumen, más participación</div>
        </div>
        <div className="stat-card">
          <div className="label">Última actualización</div>
          <div className="value">{props.market24h.updatedAt}</div>
          <div className="sub">Datos en vivo</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Señal principal</div>
            <div className="card-subtitle">La idea es ayudarte a decidir antes de tocar el botón de compra o venta.</div>
          </div>
        </div>
        <span className="decision-label">{signal?.label || "Esperar"}</span>
        <h3 style={{ fontSize: 22, margin: "10px 0" }}>{signal?.title || "Esperar confirmación"}</h3>
        <p style={{ color: "#64748b", marginBottom: 16 }}>{signal?.reasons.join(" ") || "Esperando datos."}</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 12, background: "#eff6ff", color: "#2563eb", padding: "4px 10px", borderRadius: 20 }}>{props.currentCoin}</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <span>Fuerza de la lectura</span>
            <span>{signal ? `${signal.score}%` : "0%"}</span>
          </div>
          <div style={{ background: "#e2e8f0", height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${signal?.score || 0}%`, background: "linear-gradient(90deg,#f59e0b,#d97706)", height: "100%", borderRadius: 4 }} />
          </div>
        </div>
        <ul style={{ color: "#475569", fontSize: 13, lineHeight: 1.8 }}>
          {(signal?.reasons || ["El mercado sigue recopilando contexto."]).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <details className="card" style={{ cursor: "pointer" }}>
        <summary style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Indicadores técnicos (clic para ver)</summary>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="label">RSI (14)</div>
            <div className="value">{indicators ? indicators.rsi.toFixed(1) : "50.0"}</div>
            <div className="sub">
              {indicators ? (indicators.rsi < 30 ? "Sobreventa" : indicators.rsi > 70 ? "Sobrecompra" : "Neutral") : "Neutral"}
            </div>
          </div>
          <div className="stat-card">
            <div className="label">MACD</div>
            <div className="value">{indicators?.macd || "Neutral"}</div>
            <div className="sub">Cruce de líneas</div>
          </div>
          <div className="stat-card">
            <div className="label">Media Corta (SMA 20)</div>
            <div className="value">{formatPrice(indicators?.sma20 || 0)}</div>
            <div className="sub">Tendencia corto plazo</div>
          </div>
          <div className="stat-card">
            <div className="label">Media Larga (SMA 50)</div>
            <div className="value">{formatPrice(indicators?.sma50 || 0)}</div>
            <div className="sub">Tendencia medio plazo</div>
          </div>
        </div>
      </details>

      <details className="card" style={{ cursor: "pointer" }}>
        <summary style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Soporte y resistencia (clic para ver)</summary>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="label">Soporte cercano</div>
            <div className="value">{formatPrice(props.support || 0)}</div>
            <div className="sub">Nivel donde el precio podría rebotar al alza</div>
          </div>
          <div className="stat-card">
            <div className="label">Resistencia cercana</div>
            <div className="value">{formatPrice(props.resistance || 0)}</div>
            <div className="sub">Nivel donde el precio podría frenarse</div>
          </div>
        </div>
      </details>
    </div>
  );
}
