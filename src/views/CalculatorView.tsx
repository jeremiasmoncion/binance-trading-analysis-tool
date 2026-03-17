import { BoltIcon, SparklesIcon } from "../components/Icons";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
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

const FIELD_COPY = {
  capital: "Cuanto capital real quieres arriesgar en esta idea.",
  entry: "Precio estimado al que piensas entrar o donde ya entraste.",
  percent: "Objetivo de beneficio que buscas antes de salir.",
  stopPct: "Cuanto espacio le das al mercado antes de asumir que la idea fallo.",
} as const;

export function CalculatorView(props: CalculatorViewProps) {
  const riskReward = props.result.stopLoss > 0 ? props.result.net / props.result.stopLoss : 0;

  return (
    <div id="calculatorView" className="view-panel active">
      <SectionCard
        title="Calculadora de operacion"
        subtitle="Convierte una idea de entrada en un plan claro: objetivo, perdida maxima y retorno esperado."
        helpTitle="Como usar la calculadora"
        helpBody="Aqui conviertes un posible trade en numeros simples antes de entrar. La idea es saber si la ganancia potencial compensa el riesgo."
        helpBullets={[
          "Escribe tu capital, precio de entrada, objetivo y stop.",
          "Usa la sugerencia rapida si quieres apoyarte en el analisis actual.",
          "Mira el bloque de resultados para decidir si el plan vale la pena.",
        ]}
        helpFooter="Si el retorno neto es bajo o la perdida maxima es incomoda, la operacion probablemente no merece entrar."
      />

      <div className="premium-overview-grid">
        <StatCard
          label="Retorno neto"
          value={formatPct(props.result.netPct)}
          tone={props.result.netPct >= 0 ? "profit" : "risk"}
          helpTitle="Retorno neto"
          helpBody="Es el porcentaje estimado que quedaria despues de comisiones si el precio llega a tu objetivo."
        />
        <StatCard
          label="Ganancia neta"
          value={formatPrice(props.result.net)}
          tone={props.result.net >= 0 ? "profit" : "risk"}
          helpTitle="Ganancia neta"
          helpBody="Dinero estimado que ganarias o perderias despues de descontar el costo operativo."
        />
        <StatCard
          label="Perdida maxima"
          value={formatPrice(props.result.stopLoss)}
          tone="warning"
          helpTitle="Perdida maxima"
          helpBody="Cuanto perderias si el precio toca tu stop loss. Esta cifra te ayuda a no abrir operaciones que duelan demasiado."
        />
        <StatCard
          label="Riesgo / beneficio"
          value={riskReward > 0 ? `${riskReward.toFixed(2)}x` : "0.00x"}
          tone={riskReward >= 1.5 ? "profit" : riskReward >= 1 ? "warning" : "neutral"}
          helpTitle="Relacion riesgo beneficio"
          helpBody="Compara lo que puedes ganar contra lo que puedes perder. Cuanto mas alto, mejor compensada esta la idea."
        />
      </div>

      <div className="calculator-shell-grid">
        <SectionCard
          title="Construye tu plan"
          subtitle="Llena los cuatro campos y decide si prefieres mantener control manual o partir de una sugerencia."
          helpTitle="Que significan los campos"
          helpBody="Los campos representan las cuatro preguntas basicas de cualquier operacion: cuanto pondras, donde entraras, cuanto quieres ganar y cuanto estas dispuesto a perder."
        >
          <div className="premium-panel-grid calculator-form-grid">
            <div className="premium-field">
              <label>Capital (USDT)</label>
              <input type="number" min="0" step="1" value={props.values.capital} onChange={(e) => props.onChange("capital", e.target.value)} />
              <span>{FIELD_COPY.capital}</span>
            </div>
            <div className="premium-field">
              <label>Precio de entrada (USDT)</label>
              <input type="number" step="0.01" value={props.values.entry} onChange={(e) => props.onChange("entry", e.target.value)} />
              <span>{FIELD_COPY.entry}</span>
            </div>
            <div className="premium-field">
              <label>Objetivo de ganancia (%)</label>
              <input type="number" step="0.1" value={props.values.percent} onChange={(e) => props.onChange("percent", e.target.value)} />
              <span>{FIELD_COPY.percent}</span>
            </div>
            <div className="premium-field">
              <label>Stop loss (%)</label>
              <input type="number" step="0.1" value={props.values.stopPct} onChange={(e) => props.onChange("stopPct", e.target.value)} />
              <span>{FIELD_COPY.stopPct}</span>
            </div>
          </div>

          <div className="premium-action-row">
            <button className="premium-action-button is-primary" onClick={props.onSuggest}>
              <SparklesIcon />
              Sugerir segun el analisis
            </button>
            <button className="premium-action-button is-secondary" onClick={props.onCurrentPrice}>
              <BoltIcon />
              Usar precio actual
            </button>
          </div>
        </SectionCard>

        <div className="premium-side-stack">
          <SectionCard
            title="Lectura rapida"
            subtitle="Lo mas importante antes de enviar la operacion."
            helpTitle="Como leer esta columna"
            helpBody="Esta columna resume las senales de calidad basicas que deberias ver antes de sentirte comodo con el plan."
          >
            <div className="field-guide-list">
              <div className="field-guide-item">
                <span className="field-guide-label">Punto de equilibrio</span>
                <span className="field-guide-note">Necesitas llegar a {formatPrice(props.result.breakEven)} para cubrir costo operativo.</span>
              </div>
              <div className="field-guide-item">
                <span className="field-guide-label">Salida ideal</span>
                <span className="field-guide-note">Tu objetivo actual esta en {formatPrice(props.result.exitPrice)}.</span>
              </div>
              <div className="field-guide-item">
                <span className="field-guide-label">Control de dano</span>
                <span className="field-guide-note">Si falla la idea, el cierre defensivo seria en {formatPrice(props.result.stopPrice)}.</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Buenas practicas"
            subtitle="Recordatorios para no sobreoperar."
            helpTitle="Disciplina basica"
            helpBody="La calculadora es util solo si la usas con disciplina y no fuerzas operaciones con mala relacion riesgo beneficio."
          >
            <div className="guide-pill-grid">
              <span className="guide-pill">No arriesgar de mas por impulso</span>
              <span className="guide-pill">Preferir planes con salida clara</span>
              <span className="guide-pill">No abrir si el stop queda demasiado lejos</span>
              <span className="guide-pill">Revisar comision y liquidez del par</span>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Resultados de la operacion"
        subtitle="Aqui ves el plan ya traducido a dinero real, comisiones y posible perdida."
        helpTitle="Como interpretar los resultados"
        helpBody="Los resultados te muestran si la operacion tiene sentido financiero. Si la ganancia potencial es pequena frente al stop, conviene esperar una mejor entrada."
      >
        <div className="calculator-results-grid">
          <div className="result-tile">
            <span>Precio de salida</span>
            <strong>{formatPrice(props.result.exitPrice)}</strong>
          </div>
          <div className="result-tile">
            <span>Ganancia bruta</span>
            <strong>{formatPrice(props.result.gross)}</strong>
          </div>
          <div className="result-tile">
            <span>Comision total</span>
            <strong>{formatPrice(props.result.commission)}</strong>
          </div>
          <div className="result-tile">
            <span>Ganancia neta</span>
            <strong className={props.result.net >= 0 ? "positive" : "negative"}>{formatPrice(props.result.net)}</strong>
          </div>
          <div className="result-tile">
            <span>Punto de equilibrio</span>
            <strong>{formatPrice(props.result.breakEven)}</strong>
          </div>
          <div className="result-tile">
            <span>Stop loss (precio)</span>
            <strong>{formatPrice(props.result.stopPrice)}</strong>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
