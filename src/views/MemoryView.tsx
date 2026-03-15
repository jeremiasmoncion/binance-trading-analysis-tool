import { useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { formatPrice } from "../lib/format";
import type { SignalOutcomeStatus, SignalSnapshot } from "../types";

interface MemoryViewProps {
  signals: SignalSnapshot[];
  onUpdateSignal: (id: number, outcomeStatus: SignalOutcomeStatus, outcomePnl: number, note: string) => void;
}

export function MemoryView(props: MemoryViewProps) {
  const completedSignals = props.signals.filter((item) => item.outcome_status !== "pending");
  const wins = props.signals.filter((item) => item.outcome_status === "win").length;
  const losses = props.signals.filter((item) => item.outcome_status === "loss").length;
  const invalidated = props.signals.filter((item) => item.outcome_status === "invalidated").length;
  const totalPnl = props.signals.reduce((sum, item) => sum + Number(item.outcome_pnl || 0), 0);
  const winRate = completedSignals.length ? (wins / completedSignals.length) * 100 : 0;

  return (
    <div id="memoryView" className="view-panel active">
      <SectionCard
        title="Memoria del sistema"
        subtitle="Aquí el sistema empieza a recordar señales emitidas, su plan técnico y el resultado que terminaron dando."
      />

      <div className="stats-grid">
        <StatCard label="Señales guardadas" value={String(props.signals.length)} sub="Snapshots técnicos registrados" accentClass="accent-blue" />
        <StatCard label="Win rate" value={`${winRate.toFixed(0)}%`} sub={`${wins} ganadas / ${completedSignals.length} cerradas`} accentClass="accent-green" />
        <StatCard label="PnL registrado" value={formatPrice(totalPnl)} sub={`${losses} pérdidas · ${invalidated} invalidadas`} toneClass={totalPnl > 0 ? "portfolio-positive" : totalPnl < 0 ? "portfolio-negative" : ""} accentClass="accent-emerald" />
        <StatCard label="Pendientes" value={String(props.signals.filter((item) => item.outcome_status === "pending").length)} sub="Esperando evaluación" accentClass="accent-amber" />
      </div>

      <SectionCard
        title="Historial de señales"
        subtitle="Cada fila guarda el contexto de la señal y te deja marcar el resultado real para que luego podamos medir qué setups funcionan mejor."
      >
        <div className="table-scroll">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Señal</th>
                <th>Setup</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>PnL</th>
                <th>Nota</th>
                <th>Guardar</th>
              </tr>
            </thead>
            <tbody>
              {!props.signals.length ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState message="Todavía no hay señales guardadas. Puedes empezar desde Inicio con el botón Guardar señal." />
                  </td>
                </tr>
              ) : (
                props.signals.map((signal) => (
                  <SignalRow key={signal.id} signal={signal} onSave={props.onUpdateSignal} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function SignalRow({
  signal,
  onSave,
}: {
  signal: SignalSnapshot;
  onSave: (id: number, outcomeStatus: SignalOutcomeStatus, outcomePnl: number, note: string) => void;
}) {
  const [outcomeStatus, setOutcomeStatus] = useState<SignalOutcomeStatus>(signal.outcome_status);
  const [outcomePnl, setOutcomePnl] = useState(String(signal.outcome_pnl || 0));
  const [note, setNote] = useState(signal.note || "");

  return (
    <tr>
      <td>
        <div className="portfolio-asset">
          <strong>{signal.coin}</strong>
          <span>{signal.timeframe} · {signal.signal_label} · {new Date(signal.created_at).toLocaleString("es-DO")}</span>
        </div>
      </td>
      <td>
        <div className="portfolio-metric">
          <strong>{signal.setup_type || "Sin setup"}</strong>
          <span>{signal.setup_quality || "Media"} · Riesgo {signal.risk_label || "controlado"}</span>
        </div>
      </td>
      <td>
        <div className="portfolio-metric">
          <strong>{signal.entry_price ? formatPrice(signal.entry_price) : "--"}</strong>
          <span>
            TP1 {signal.tp_price ? formatPrice(signal.tp_price) : "--"} · SL {signal.sl_price ? formatPrice(signal.sl_price) : "--"}
          </span>
        </div>
      </td>
      <td>
        <select className="timeframe-select signal-select" value={outcomeStatus} onChange={(e) => setOutcomeStatus(e.target.value as SignalOutcomeStatus)}>
          <option value="pending">Pending</option>
          <option value="win">Win</option>
          <option value="loss">Loss</option>
          <option value="invalidated">Invalidated</option>
        </select>
      </td>
      <td>
        <input
          className="signal-memory-input"
          value={outcomePnl}
          onChange={(e) => setOutcomePnl(e.target.value)}
          placeholder="0.00"
        />
      </td>
      <td>
        <input
          className="signal-memory-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Qué pasó con esta señal"
        />
      </td>
      <td>
        <button className="btn-secondary-soft" type="button" onClick={() => onSave(signal.id, outcomeStatus, Number(outcomePnl || 0), note)}>
          Guardar
        </button>
      </td>
    </tr>
  );
}
