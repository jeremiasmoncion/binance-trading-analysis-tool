import { useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SignalOutcomeStatus | "all">("all");
  const [timeframeFilter, setTimeframeFilter] = useState("all");
  const [setupFilter, setSetupFilter] = useState("all");

  const timeframes = useMemo(
    () => Array.from(new Set(props.signals.map((item) => item.timeframe))).sort(),
    [props.signals],
  );
  const setups = useMemo(
    () => Array.from(new Set(props.signals.map((item) => item.setup_type).filter(Boolean))).sort(),
    [props.signals],
  );

  const filteredSignals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return props.signals.filter((item) => {
      const matchesSearch = !normalizedSearch
        || item.coin.toLowerCase().includes(normalizedSearch)
        || (item.signal_label || "").toLowerCase().includes(normalizedSearch)
        || (item.setup_type || "").toLowerCase().includes(normalizedSearch)
        || (item.note || "").toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || item.outcome_status === statusFilter;
      const matchesTimeframe = timeframeFilter === "all" || item.timeframe === timeframeFilter;
      const matchesSetup = setupFilter === "all" || (item.setup_type || "") === setupFilter;
      return matchesSearch && matchesStatus && matchesTimeframe && matchesSetup;
    });
  }, [props.signals, search, setupFilter, statusFilter, timeframeFilter]);

  const completedSignals = props.signals.filter((item) => item.outcome_status !== "pending");
  const wins = props.signals.filter((item) => item.outcome_status === "win").length;
  const losses = props.signals.filter((item) => item.outcome_status === "loss").length;
  const invalidated = props.signals.filter((item) => item.outcome_status === "invalidated").length;
  const totalPnl = props.signals.reduce((sum, item) => sum + Number(item.outcome_pnl || 0), 0);
  const winRate = completedSignals.length ? (wins / completedSignals.length) * 100 : 0;
  const bestSetup = useMemo(() => {
    const bySetup = new Map<string, { wins: number; total: number }>();
    props.signals.forEach((item) => {
      if (!item.setup_type || item.outcome_status === "pending") return;
      const bucket = bySetup.get(item.setup_type) || { wins: 0, total: 0 };
      bucket.total += 1;
      if (item.outcome_status === "win") bucket.wins += 1;
      bySetup.set(item.setup_type, bucket);
    });
    return Array.from(bySetup.entries())
      .map(([setup, stats]) => ({ setup, rate: stats.total ? (stats.wins / stats.total) * 100 : 0, total: stats.total }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total)[0];
  }, [props.signals]);
  const strongestTimeframe = useMemo(() => {
    const byTimeframe = new Map<string, { wins: number; total: number }>();
    props.signals.forEach((item) => {
      if (item.outcome_status === "pending") return;
      const bucket = byTimeframe.get(item.timeframe) || { wins: 0, total: 0 };
      bucket.total += 1;
      if (item.outcome_status === "win") bucket.wins += 1;
      byTimeframe.set(item.timeframe, bucket);
    });
    return Array.from(byTimeframe.entries())
      .map(([timeframe, stats]) => ({ timeframe, rate: stats.total ? (stats.wins / stats.total) * 100 : 0, total: stats.total }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total)[0];
  }, [props.signals]);

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

      <div className="stats-grid">
        <StatCard
          label="Mejor setup"
          value={bestSetup?.setup || "--"}
          sub={bestSetup ? `${bestSetup.rate.toFixed(0)}% de efectividad en ${bestSetup.total} señales` : "Todavía faltan cierres para medirlo"}
          accentClass="accent-blue"
        />
        <StatCard
          label="Marco más fuerte"
          value={strongestTimeframe?.timeframe || "--"}
          sub={strongestTimeframe ? `${strongestTimeframe.rate.toFixed(0)}% de win rate` : "Esperando más señales cerradas"}
          accentClass="accent-amber"
        />
      </div>

      <SectionCard
        title="Historial de señales"
        subtitle="Cada fila guarda el contexto de la señal. Las señales fuertes se registran solas y el sistema intenta cerrar pendientes automáticamente cuando el precio toca TP o SL."
      >
        <div className="memory-filter-bar">
          <input
            className="signal-memory-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por par, señal, setup o nota"
          />
          <select className="timeframe-select signal-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SignalOutcomeStatus | "all")}>
            <option value="all">Todos los estados</option>
            <option value="pending">Pending</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="invalidated">Invalidated</option>
          </select>
          <select className="timeframe-select signal-select" value={timeframeFilter} onChange={(event) => setTimeframeFilter(event.target.value)}>
            <option value="all">Todos los marcos</option>
            {timeframes.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select className="timeframe-select signal-select" value={setupFilter} onChange={(event) => setSetupFilter(event.target.value)}>
            <option value="all">Todos los setups</option>
            {setups.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <p className="section-note with-bottom-gap">
          Mostrando {filteredSignals.length} de {props.signals.length} señales registradas.
        </p>
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
              ) : !filteredSignals.length ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState message="No hay señales que coincidan con los filtros actuales." />
                  </td>
                </tr>
              ) : (
                filteredSignals.map((signal) => (
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
