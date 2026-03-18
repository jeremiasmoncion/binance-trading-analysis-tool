import { SparklesIcon } from "../components/Icons";
import { SectionCard } from "../components/ui/SectionCard";

const LEARN_PILLARS = [
  "Entender primero antes de automatizar",
  "Proteger capital antes de buscar mas ganancia",
  "Leer contexto antes de entrar",
  "Usar reglas antes que emociones",
];

const LEARN_MODULES = [
  {
    title: "Fundamentos del trade",
    subtitle: "Lo minimo que debes dominar antes de abrir una posicion.",
    lessons: [
      {
        label: "Stop loss",
        body: "Es la salida defensiva que limita tu perdida si la idea falla. No es castigo, es proteccion.",
      },
      {
        label: "Take profit",
        body: "Es la salida a favor que asegura ganancia cuando el precio llega al objetivo planeado.",
      },
      {
        label: "Riesgo por operacion",
        body: "No deberias arriesgar tanto en una sola entrada que una operacion mala te saque emocionalmente del juego.",
      },
    ],
  },
  {
    title: "Tipos de orden",
    subtitle: "Como elegir la forma correcta de entrar o salir.",
    lessons: [
      {
        label: "Market",
        body: "Entra o sale al precio disponible en ese instante. Es rapido, pero menos preciso.",
      },
      {
        label: "Limit",
        body: "Te deja definir el precio al que quieres comprar o vender. Es mas controlado, aunque puede no ejecutarse.",
      },
      {
        label: "Stop",
        body: "Sirve para activar una salida defensiva cuando el mercado rompe tu punto de invalidacion.",
      },
    ],
  },
  {
    title: "Proteccion y seguimiento",
    subtitle: "Como mantener una operacion saludable despues de abrirla.",
    lessons: [
      {
        label: "Gestion de posicion",
        body: "Abrir la operacion es solo el inicio. Luego toca vigilar objetivo, stop, contexto y reaccion del precio.",
      },
      {
        label: "No sobreoperar",
        body: "Mas operaciones no significa mas dinero. A veces la mejor decision es esperar una mejor senal.",
      },
      {
        label: "Bitacora mental",
        body: "Si sabes por que entraste, te sera mucho mas facil saber por que saliste y que debes mejorar.",
      },
    ],
  },
];

export function LearnView() {
  return (
    <div id="learnView" className="view-panel active">
      <SectionCard
        title="Aprender"
        subtitle="Convierte conceptos de trading en ideas simples, utiles y faciles de aplicar dentro del sistema."
        helpTitle="Como usar esta zona"
        helpBody="No necesitas memorizar todo. Usa esta vista como una guia rapida cuando algo del sistema te suene tecnico o cuando quieras reforzar disciplina."
        helpBullets={[
          "Empieza por Fundamentos si todavia te cuesta leer stop, take profit o riesgo.",
          "Usa Tipos de orden para entender por que una ejecucion puede ir por market o limit.",
          "Vuelve a Proteccion y seguimiento si tiendes a moverte sin plan despues de abrir una operacion.",
        ]}
      />

      <div className="premium-overview-grid">
        {LEARN_PILLARS.map((pillar) => (
          <div className="learn-pill-card" key={pillar}>
            <SparklesIcon />
            <span>{pillar}</span>
          </div>
        ))}
      </div>

      <div className="learn-shell-grid">
        {LEARN_MODULES.map((module) => (
          <SectionCard
            key={module.title}
            title={module.title}
            subtitle={module.subtitle}
            helpTitle={module.title}
            helpBody={module.subtitle}
          >
            <div className="learn-module-list">
              {module.lessons.map((lesson) => (
                <article className="learn-lesson-card" key={lesson.label}>
                  <strong>{lesson.label}</strong>
                  <p>{lesson.body}</p>
                </article>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>

      <SectionCard
        title="Idea central"
        subtitle="Una buena operacion no nace solo de una senal, nace de entender lo que estas haciendo."
        helpTitle="Idea central"
        helpBody="Esta plataforma puede ayudarte mucho, pero el mejor resultado llega cuando entiendes el plan que estas siguiendo."
      >
        <div className="guide-pill-grid">
          <span className="guide-pill">Primero entender</span>
          <span className="guide-pill">Luego validar</span>
          <span className="guide-pill">Despues automatizar</span>
          <span className="guide-pill">Siempre proteger capital</span>
        </div>
      </SectionCard>
    </div>
  );
}
