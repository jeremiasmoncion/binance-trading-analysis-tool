import { formatPrice } from "../lib/format";
import type { ComparisonCoin } from "../types";

interface CompareViewProps {
  comparison: ComparisonCoin[];
  currentCoin: string;
  onSelectCoin: (coin: string) => void;
}

export function CompareView({ comparison, currentCoin, onSelectCoin }: CompareViewProps) {
  return (
    <div id="compareView" className="view-panel active">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Comparar monedas</div>
            <div className="card-subtitle">Compara impulso, tendencia y lectura general entre distintos pares.</div>
          </div>
        </div>
      </div>

      <div className="comparison-grid">
        {!comparison.length ? (
          <p style={{ color: "#64748b" }}>Cargando comparación...</p>
        ) : (
          comparison.map((coin) => (
            <div
              key={coin.symbol}
              className={`coin-card ${coin.symbol === currentCoin ? "active" : ""}`}
              onClick={() => onSelectCoin(coin.symbol)}
            >
              <div className="coin-name">{coin.symbol}</div>
              <div className="coin-price">{formatPrice(coin.price)}</div>
              <div className={`coin-change ${coin.change >= 0 ? "positive" : "negative"}`}>
                {coin.change >= 0 ? "+" : ""}
                {coin.change.toFixed(2)}%
              </div>
              <div className="coin-impulse">
                <span>Impulso:</span>
                <span>{coin.impulse}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
