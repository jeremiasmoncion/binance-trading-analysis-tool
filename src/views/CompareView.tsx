import { EmptyState } from "../components/ui/EmptyState";
import { SectionCard } from "../components/ui/SectionCard";
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
      <SectionCard title="Comparar monedas" subtitle="Compara impulso, tendencia y lectura general entre distintos pares." />

      <div className="comparison-grid">
        {!comparison.length ? (
          <EmptyState message="Cargando comparación..." />
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
