import { EmptyState } from "../components/ui/EmptyState";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { formatPrice, formatSignedPct } from "../lib/format";
import type { ComparisonCoin } from "../types";

interface CompareViewProps {
  comparison: ComparisonCoin[];
  currentCoin: string;
  onSelectCoin: (coin: string) => void;
}

function impulseTone(impulse: string) {
  if (/alc|bull|fuer/i.test(impulse)) return "accent-profit";
  if (/baj|bear|deb/i.test(impulse)) return "accent-risk";
  return "accent-info";
}

export function CompareView({ comparison, currentCoin, onSelectCoin }: CompareViewProps) {
  const leader = [...comparison].sort((a, b) => b.change - a.change)[0];
  const laggard = [...comparison].sort((a, b) => a.change - b.change)[0];
  const active = comparison.find((coin) => coin.symbol === currentCoin) ?? comparison[0];

  return (
    <div id="compareView" className="view-panel active">
      <SectionCard
        title="Comparar monedas"
        subtitle="Lee rapido que moneda lidera, cual se esta debilitando y donde esta el foco actual del sistema."
        helpTitle="Como usar esta vista"
        helpBody="Esta pantalla no es para adivinar. Sirve para priorizar rapidamente que activos merecen tu atencion ahora mismo."
        helpBullets={[
          "La moneda lider muestra quien tiene mejor impulso reciente.",
          "La mas debil te avisa donde conviene ir con mas cuidado.",
          "El mapa de monedas te deja saltar de una idea a otra sin perder contexto.",
        ]}
      />

      <div className="premium-overview-grid">
        <StatCard label="Moneda lider" value={leader?.symbol ?? "--"} detail={leader ? formatSignedPct(leader.change) : "Sin datos"} tone="profit" />
        <StatCard label="Moneda mas debil" value={laggard?.symbol ?? "--"} detail={laggard ? formatSignedPct(laggard.change) : "Sin datos"} tone="risk" />
        <StatCard label="Moneda activa" value={active?.symbol ?? "--"} detail={active?.impulse ?? "Sin lectura"} tone="accent" />
        <StatCard label="Lectura rapida" value={active ? formatPrice(active.price) : "--"} detail={active ? `Cambio ${formatSignedPct(active.change)}` : "Sin datos"} tone="neutral" />
      </div>

      {!comparison.length ? (
        <EmptyState message="Cargando mapa comparativo..." />
      ) : (
        <>
          <div className="compare-summary-grid">
            <SectionCard
              title="Moneda en foco"
              subtitle="La tarjeta principal te resume lo mas importante del par que tienes seleccionado."
              helpTitle="Moneda en foco"
              helpBody="Usa este bloque para decidir si profundizar en el activo activo o cambiar rapido hacia uno con mejor momentum."
            >
              <div className="compare-spotlight">
                <div className="compare-spotlight-head">
                  <span className="compare-symbol">{active?.symbol ?? "--"}</span>
                  <span className={`comparison-impulse-chip ${impulseTone(active?.impulse ?? "")}`}>{active?.impulse ?? "Sin impulso"}</span>
                </div>
                <div className="compare-price">{active ? formatPrice(active.price) : "--"}</div>
                <div className={`compare-change ${active && active.change >= 0 ? "positive" : "negative"}`}>
                  {active ? formatSignedPct(active.change) : "--"}
                </div>
                <div className="compare-pill-row">
                  <span className="guide-pill">Par activo</span>
                  <span className="guide-pill">Pulsa cualquier tarjeta para cambiarlo</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Que mirar primero"
              subtitle="Mini checklist para no perderte entre tantos pares."
              helpTitle="Lectura basica"
              helpBody="Cuando compares monedas, piensa primero en direccion, luego en fuerza relativa y por ultimo en si esa lectura acompana la temporalidad que operas."
            >
              <div className="field-guide-list">
                <div className="field-guide-item">
                  <span className="field-guide-label">1. Direccion</span>
                  <span className="field-guide-note">Empieza viendo quien esta subiendo o perdiendo fuerza.</span>
                </div>
                <div className="field-guide-item">
                  <span className="field-guide-label">2. Impulso</span>
                  <span className="field-guide-note">El chip de impulso te orienta sobre el tono general del activo.</span>
                </div>
                <div className="field-guide-item">
                  <span className="field-guide-label">3. Salto rapido</span>
                  <span className="field-guide-note">Haz clic en una tarjeta para llevar esa moneda al centro del analisis.</span>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Mapa de monedas"
            subtitle="Todas las monedas comparadas en una grilla mas visual para detectar lideres y rezagadas."
            helpTitle="Como leer la grilla"
            helpBody="Las monedas verdes suelen destacar por mejor cambio relativo. Las que muestran lectura roja o debil son candidatas a mayor prudencia."
          >
            <div className="comparison-rank-grid">
              {comparison.map((coin, index) => (
                <button
                  type="button"
                  key={coin.symbol}
                  className={`comparison-coin-tile ${coin.symbol === currentCoin ? "is-active" : ""}`}
                  onClick={() => onSelectCoin(coin.symbol)}
                >
                  <div className="comparison-coin-top">
                    <span className="comparison-rank">#{index + 1}</span>
                    <span className={`comparison-impulse-chip ${impulseTone(coin.impulse)}`}>{coin.impulse}</span>
                  </div>
                  <div className="comparison-coin-symbol">{coin.symbol}</div>
                  <div className="comparison-coin-price">{formatPrice(coin.price)}</div>
                  <div className={`comparison-coin-change ${coin.change >= 0 ? "positive" : "negative"}`}>{formatSignedPct(coin.change)}</div>
                </button>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
