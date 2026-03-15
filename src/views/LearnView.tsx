const LEARN_CARDS = [
  ["Concepto básico", "¿Qué es el Stop Loss?", "Es una orden automática que vende tu criptomoneda si el precio baja hasta cierto nivel. Sirve para limitar tus pérdidas. Ejemplo: compras BTC a $70,000 y pones stop loss en $69,000. Si el precio cae a $69,000, se vende automáticamente y pierdes solo $1,000 en vez de arriesgar más."],
  ["Tipo de orden", "Orden Market", "Es una compra o venta inmediata al precio actual del mercado. Es rápida pero no controlas el precio exacto. Úsala cuando quieras entrar o salir rápido de una operación."],
  ["Tipo de orden", "Orden Limit", "Es una compra o venta a un precio específico que tú eliges. La orden solo se ejecuta si el mercado llega a ese precio. Es más lenta pero tienes control total del precio."],
  ["Tipo de orden", "Stop-Limit", "Combina stop loss con orden limit. Cuando el precio llega a tu stop, se activa una orden limit. Útil para proteger ganancias pero requiere más conocimiento."],
  ["Estrategia", "Trailing Stop", "Es un stop loss que se mueve automáticamente a favor tuyo cuando el precio sube. Si el precio baja, el stop se queda donde está. Sirve para proteger ganancias sin salirte muy pronto."],
  ["Consejo", "Take Profit", "Es una orden para vender automáticamente cuando el precio sube hasta tu objetivo. Así aseguras ganancias sin necesidad de estar mirando el mercado todo el tiempo."],
  ["Consejo", "Gestión de riesgo", "Nunca arriesgues más del 1-2% de tu capital en una sola operación. Si tienes $100, no pierdas más de $1-2 por operación. Esto te permite sobrevivir a varias operaciones malas seguidas."],
  ["Consejo", "Capital mínimo recomendado", "Para operaciones cortas con comisiones de Binance, se recomienda mínimo $15-20 USDT. Con menos de eso, las comisiones pueden comerse casi toda tu ganancia potencial."],
] as const;

export function LearnView() {
  return (
    <div id="learnView" className="view-panel">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Aprender</div>
            <div className="card-subtitle">Glosario práctico y consejos para principiantes antes de operar en Binance.</div>
          </div>
        </div>
      </div>

      <div className="learn-grid">
        {LEARN_CARDS.map(([tag, title, content]) => (
          <div className="learn-card" key={title}>
            <span className="tag">{tag}</span>
            <h3>{title}</h3>
            <p>{content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
