import { formatPct, formatPrice } from "../lib/format";

interface CalculatorViewProps {
  values: {
    capital: string;
    entry: string;
    percent: string;
    stopPct: string;
  };
  result: {
    exitPrice: number;
    gross: number;
    commission: number;
    net: number;
    netPct: number;
    breakEven: number;
    stopPrice: number;
    stopLoss: number;
  };
  onChange: (field: "capital" | "entry" | "percent" | "stopPct", value: string) => void;
  onSuggest: () => void;
  onCurrentPrice: () => void;
}

export function CalculatorView(props: CalculatorViewProps) {
  const netClass = props.result.net >= 0 ? "positive" : "negative";
  const netPctClass = props.result.netPct >= 0 ? "positive" : "negative";

  return (
    <div id="calculatorView" className="view-panel">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Calculadora de operación</div>
            <div className="card-subtitle">Mantén el control manual de tu objetivo y tu stop o pide una sugerencia cuando quieras.</div>
          </div>
        </div>
      </div>

      <div className="calculator-grid">
        <div>
          <div className="calc-input-group">
            <label>Capital (USDT)</label>
            <input type="number" min="0" step="1" value={props.values.capital} onChange={(e) => props.onChange("capital", e.target.value)} />
          </div>
          <div className="calc-input-group">
            <label>Precio de entrada (USDT)</label>
            <input type="number" step="0.01" value={props.values.entry} onChange={(e) => props.onChange("entry", e.target.value)} />
          </div>
          <div className="calc-input-group">
            <label>Porcentaje de ganancia (%)</label>
            <input type="number" step="0.1" value={props.values.percent} onChange={(e) => props.onChange("percent", e.target.value)} />
          </div>
          <div className="calc-input-group">
            <label>Stop loss (%)</label>
            <input type="number" step="0.1" value={props.values.stopPct} onChange={(e) => props.onChange("stopPct", e.target.value)} />
          </div>
          <button className="btn-calc btn-suggest" onClick={props.onSuggest}>
            💡 Sugerir según análisis
          </button>
          <button className="btn-calc btn-current" onClick={props.onCurrentPrice}>
            ⚡ Usar precio actual
          </button>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
            💡 Comisión de Binance: 0.1% compra + 0.1% venta = 0.2% total. Capital mínimo recomendado: $15-20 USDT para operaciones cortas.
          </p>
        </div>

        <div className="calc-results">
          <h4 style={{ marginBottom: 14, fontSize: 15 }}>Resultados de la operación</h4>
          <div className="result-row"><span className="result-label">Precio de venta</span><span className="result-value">{formatPrice(props.result.exitPrice)}</span></div>
          <div className="result-row"><span className="result-label">Ganancia bruta</span><span className="result-value">{formatPrice(props.result.gross)}</span></div>
          <div className="result-row"><span className="result-label">Comisión total</span><span className="result-value">{formatPrice(props.result.commission)}</span></div>
          <div className="result-row"><span className="result-label">Ganancia neta</span><span className={`result-value ${netClass}`}>{formatPrice(props.result.net)}</span></div>
          <div className="result-row"><span className="result-label">Retorno neto</span><span className={`result-value ${netPctClass}`}>{formatPct(props.result.netPct)}</span></div>
          <div className="result-row"><span className="result-label">Punto de equilibrio</span><span className="result-value">{formatPrice(props.result.breakEven)}</span></div>
          <div className="result-row"><span className="result-label">Stop loss (precio)</span><span className="result-value">{formatPrice(props.result.stopPrice)}</span></div>
          <div className="result-row"><span className="result-label">Pérdida si toca stop</span><span className="result-value" style={{ color: "#ef4444" }}>{formatPrice(props.result.stopLoss)}</span></div>
        </div>
      </div>
    </div>
  );
}
