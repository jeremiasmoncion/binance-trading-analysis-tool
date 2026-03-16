import { useMemo, useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { formatPrice, formatSignedPrice } from "../lib/format";
import type { SignalOutcomeStatus, SignalSnapshot } from "../types";

interface MemoryViewProps {
  signals: SignalSnapshot[];
  watchlist: string[];
  onUpdateSignal: (id: number, outcomeStatus: SignalOutcomeStatus, outcomePnl: number, note: string) => void;
}

export function MemoryView(props: MemoryViewProps) {
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"all" | "1d" | "7d" | "30d">("all");
  const [coinFilter, setCoinFilter] = useState("all");
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
  const coins = useMemo(
    () => Array.from(new Set(props.signals.map((item) => item.coin).filter(Boolean))).sort(),
    [props.signals],
  );

  const periodSignals = useMemo(() => {
    if (periodFilter === "all") return props.signals;
    const days = periodFilter === "30d" ? 30 : periodFilter === "7d" ? 7 : 1;
    const minDate = Date.now() - days * 24 * 60 * 60 * 1000;
    return props.signals.filter((item) => {
      const baseDate = item.outcome_status === "pending" ? item.created_at : (item.updated_at || item.created_at);
      return new Date(baseDate).getTime() >= minDate;
    });
  }, [periodFilter, props.signals]);

  const filteredSignals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return periodSignals.filter((item) => {
      const matchesSearch = !normalizedSearch
        || item.coin.toLowerCase().includes(normalizedSearch)
        || (item.signal_label || "").toLowerCase().includes(normalizedSearch)
        || (item.setup_type || "").toLowerCase().includes(normalizedSearch)
        || (item.note || "").toLowerCase().includes(normalizedSearch);
      const matchesCoin = coinFilter === "all" || item.coin === coinFilter;
      const matchesStatus = statusFilter === "all" || item.outcome_status === statusFilter;
      const matchesTimeframe = timeframeFilter === "all" || item.timeframe === timeframeFilter;
      const matchesSetup = setupFilter === "all" || (item.setup_type || "") === setupFilter;
      return matchesSearch && matchesCoin && matchesStatus && matchesTimeframe && matchesSetup;
    });
  }, [coinFilter, periodSignals, search, setupFilter, statusFilter, timeframeFilter]);

  const completedSignals = props.signals.filter((item) => item.outcome_status !== "pending");
  const wins = props.signals.filter((item) => item.outcome_status === "win").length;
  const losses = props.signals.filter((item) => item.outcome_status === "loss").length;
  const invalidated = props.signals.filter((item) => item.outcome_status === "invalidated").length;
  const totalPnl = props.signals.reduce((sum, item) => sum + Number(item.outcome_pnl || 0), 0);
  const winRate = completedSignals.length ? (wins / completedSignals.length) * 100 : 0;
  const periodCompletedSignals = periodSignals.filter((item) => item.outcome_status !== "pending");
  const periodWins = periodSignals.filter((item) => item.outcome_status === "win").length;
  const periodLosses = periodSignals.filter((item) => item.outcome_status === "loss").length;
  const periodInvalidated = periodSignals.filter((item) => item.outcome_status === "invalidated").length;
  const periodPending = periodSignals.filter((item) => item.outcome_status === "pending").length;
  const periodGrossWins = periodSignals
    .filter((item) => Number(item.outcome_pnl || 0) > 0)
    .reduce((sum, item) => sum + Number(item.outcome_pnl || 0), 0);
  const periodGrossLosses = periodSignals
    .filter((item) => Number(item.outcome_pnl || 0) < 0)
    .reduce((sum, item) => sum + Math.abs(Number(item.outcome_pnl || 0)), 0);
  const periodAvgWin = periodSignals.filter((item) => Number(item.outcome_pnl || 0) > 0).length
    ? periodGrossWins / periodSignals.filter((item) => Number(item.outcome_pnl || 0) > 0).length
    : 0;
  const periodAvgLoss = periodSignals.filter((item) => Number(item.outcome_pnl || 0) < 0).length
    ? periodGrossLosses / periodSignals.filter((item) => Number(item.outcome_pnl || 0) < 0).length
    : 0;
  const periodLabel = periodFilter === "30d" ? "últimos 30 días" : periodFilter === "7d" ? "últimos 7 días" : periodFilter === "1d" ? "últimas 24h" : "todo el historial";
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
  const bestContext = useMemo(() => {
    const byContext = new Map<string, { wins: number; total: number }>();
    props.signals.forEach((item) => {
      const signature = item.signal_payload?.context?.contextSignature;
      if (!signature || item.outcome_status === "pending") return;
      const bucket = byContext.get(signature) || { wins: 0, total: 0 };
      bucket.total += 1;
      if (item.outcome_status === "win") bucket.wins += 1;
      byContext.set(signature, bucket);
    });
    return Array.from(byContext.entries())
      .map(([signature, stats]) => ({ signature, rate: stats.total ? (stats.wins / stats.total) * 100 : 0, total: stats.total }))
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
  const periodAnalytics = useMemo(() => {
    const closed = periodSignals.filter((item) => item.outcome_status !== "pending");

    const byCoin = summarizeByKey(closed, (item) => item.coin);
    const bySetup = summarizeByKey(closed, (item) => item.setup_type || "Sin setup");
    const byTimeframe = summarizeByKey(closed, (item) => item.timeframe);
    const byContext = summarizeByKey(
      closed,
      (item) => item.signal_payload?.context?.contextSignature || "Contexto no clasificado",
    );

    return {
      bestCoin: byCoin[0],
      worstCoin: [...byCoin].sort((a, b) => a.pnl - b.pnl || a.winRate - b.winRate)[0],
      bestSetupPnl: bySetup[0],
      bestTimeframePnl: byTimeframe[0],
      topCoins: byCoin.slice(0, 3),
      topSetups: bySetup.slice(0, 3),
      topTimeframes: byTimeframe.slice(0, 3),
      topContexts: byContext.slice(0, 3),
    };
  }, [periodSignals]);

  return (
    <div id="memoryView" className="view-panel active">
      <section id="signals-overview">
        <SectionCard
          title="Señales del sistema"
          subtitle="Aquí el sistema guarda señales emitidas, su contexto técnico y el resultado que terminaron dando para medir qué setups funcionan mejor."
        />
      </section>

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
        <StatCard
          label="Mejor contexto"
          value={bestContext?.signature?.split(" | ")[0] || "--"}
          sub={bestContext ? `${bestContext.rate.toFixed(0)}% en ${bestContext.total} señales · ${bestContext.signature}` : "Esperando suficiente historial"}
          accentClass="accent-emerald"
        />
      </div>

      <div className="stats-grid">
        <StatCard label="Ganadas en período" value={String(periodWins)} sub={`Cierres ganadores en ${periodLabel}`} accentClass="accent-green" />
        <StatCard label="Perdidas en período" value={String(periodLosses)} sub={`Cierres perdedores en ${periodLabel}`} accentClass="accent-amber" />
        <StatCard label="Invalidadas" value={String(periodInvalidated)} sub={`Señales descartadas en ${periodLabel}`} accentClass="accent-blue" />
        <StatCard label="Pendientes en período" value={String(periodPending)} sub={`Todavía abiertas en ${periodLabel}`} accentClass="accent-emerald" />
      </div>

      <section id="signals-analytics">
        <SectionCard
          title="Analítica de señales"
          subtitle={`Lectura resumida de qué está rindiendo mejor y peor en ${periodLabel}.`}
        >
        <div className="stats-grid">
          <StatCard
            label="Par más rentable"
            value={periodAnalytics.bestCoin?.label || "--"}
            sub={periodAnalytics.bestCoin ? `${formatSignedPrice(periodAnalytics.bestCoin.pnl)} · ${periodAnalytics.bestCoin.winRate.toFixed(0)}% win rate` : "Esperando cierres suficientes"}
            toneClass={periodAnalytics.bestCoin && periodAnalytics.bestCoin.pnl > 0 ? "portfolio-positive" : ""}
            accentClass="accent-green"
          />
          <StatCard
            label="Par más débil"
            value={periodAnalytics.worstCoin?.label || "--"}
            sub={periodAnalytics.worstCoin ? `${formatSignedPrice(periodAnalytics.worstCoin.pnl)} · ${periodAnalytics.worstCoin.winRate.toFixed(0)}% win rate` : "Todavía no hay pérdidas cerradas"}
            toneClass={periodAnalytics.worstCoin && periodAnalytics.worstCoin.pnl < 0 ? "portfolio-negative" : ""}
            accentClass="accent-amber"
          />
          <StatCard
            label="Setup más rentable"
            value={periodAnalytics.bestSetupPnl?.label || "--"}
            sub={periodAnalytics.bestSetupPnl ? `${formatSignedPrice(periodAnalytics.bestSetupPnl.pnl)} en ${periodAnalytics.bestSetupPnl.total} señales` : "Sin historial suficiente"}
            toneClass={periodAnalytics.bestSetupPnl && periodAnalytics.bestSetupPnl.pnl > 0 ? "portfolio-positive" : ""}
            accentClass="accent-blue"
          />
          <StatCard
            label="Marco con mejor PnL"
            value={periodAnalytics.bestTimeframePnl?.label || "--"}
            sub={periodAnalytics.bestTimeframePnl ? `${formatSignedPrice(periodAnalytics.bestTimeframePnl.pnl)} · ${periodAnalytics.bestTimeframePnl.winRate.toFixed(0)}% de acierto` : "Sin datos cerrados todavía"}
            toneClass={periodAnalytics.bestTimeframePnl && periodAnalytics.bestTimeframePnl.pnl > 0 ? "portfolio-positive" : ""}
            accentClass="accent-emerald"
          />
        </div>

        <div className="signal-analytics-grid">
          <AnalyticsListCard
            title="Top pares"
            subtitle="Qué monedas están dejando mejor resultado neto."
            items={periodAnalytics.topCoins}
          />
          <AnalyticsListCard
            title="Top setups"
            subtitle="Qué tipo de entrada está funcionando mejor."
            items={periodAnalytics.topSetups}
          />
          <AnalyticsListCard
            title="Top marcos"
            subtitle="Qué timeframe está siendo más eficiente."
            items={periodAnalytics.topTimeframes}
          />
          <AnalyticsListCard
            title="Top contextos"
            subtitle="Combinaciones de contexto con mejor rendimiento."
            items={periodAnalytics.topContexts}
            truncateLabel
          />
        </div>
        </SectionCard>
      </section>

      <section id="signals-history">
        <SectionCard
          title="Historial de señales"
          subtitle="Se trabaja solo con monedas de tu watchlist. Las señales fuertes se registran solas y el sistema intenta cerrar pendientes automáticamente cuando el precio toca TP o SL."
        >
        <p className="section-note with-bottom-gap">
          Monedas en watchlist: {props.watchlist.length ? props.watchlist.join(", ") : "todavía no has marcado ninguna con estrella"}.
        </p>
        <p className="section-note with-bottom-gap">
          `Pendiente` significa que la señal sigue abierta: todavía no ha tocado `TP` ni `SL`, o aún no la has cerrado manualmente.
        </p>
        <div className="memory-filter-bar">
          <select className="timeframe-select signal-select" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as "all" | "1d" | "7d" | "30d")}>
            <option value="all">Todo el historial</option>
            <option value="1d">Últimas 24h</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>
          <input
            className="signal-memory-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por par, señal, setup o nota"
          />
          <select className="timeframe-select signal-select" value={coinFilter} onChange={(event) => setCoinFilter(event.target.value)}>
            <option value="all">Todas las monedas</option>
            {coins.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select className="timeframe-select signal-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SignalOutcomeStatus | "all")}>
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="win">Ganada</option>
            <option value="loss">Perdida</option>
            <option value="invalidated">Invalidada</option>
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
          Mostrando {filteredSignals.length} de {periodSignals.length} señales en {periodLabel}.
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
      </section>

      <div className="stats-grid">
        <StatCard
          label="Total ganado"
          value={periodGrossWins ? formatSignedPrice(periodGrossWins) : "--"}
          sub={periodGrossWins ? `Suma de cierres ganadores en ${periodLabel}` : `Sin ganancias cerradas en ${periodLabel}`}
          toneClass="portfolio-positive"
          accentClass="accent-green"
        />
        <StatCard
          label="Total perdido"
          value={periodGrossLosses ? `-${formatPrice(periodGrossLosses)}` : "--"}
          sub={periodGrossLosses ? `Suma de cierres perdedores en ${periodLabel}` : `Sin pérdidas cerradas en ${periodLabel}`}
          toneClass="portfolio-negative"
          accentClass="accent-amber"
        />
        <StatCard
          label="Ganancia promedio"
          value={periodGrossWins ? formatSignedPrice(periodAvgWin) : "--"}
          sub={periodGrossWins ? `Ganancia media por operación ganada en ${periodLabel}` : "Todavía no hay ganancias cerradas"}
          toneClass="portfolio-positive"
          accentClass="accent-green"
        />
        <StatCard
          label="Pérdida promedio"
          value={periodGrossLosses ? `-${formatPrice(periodAvgLoss)}` : "--"}
          sub={periodGrossLosses ? `Pérdida media por operación perdida en ${periodLabel}` : "Todavía no hay pérdidas cerradas"}
          toneClass="portfolio-negative"
          accentClass="accent-amber"
        />
        <StatCard
          label="Expectativa por señal"
          value={periodCompletedSignals.length ? formatSignedPrice((periodGrossWins - periodGrossLosses) / periodCompletedSignals.length) : "--"}
          sub={periodCompletedSignals.length ? `Lo que deja el sistema por señal cerrada en ${periodLabel}` : "Esperando más cierres"}
          toneClass={periodCompletedSignals.length && ((periodGrossWins - periodGrossLosses) / periodCompletedSignals.length) > 0 ? "portfolio-positive" : periodCompletedSignals.length && ((periodGrossWins - periodGrossLosses) / periodCompletedSignals.length) < 0 ? "portfolio-negative" : ""}
          accentClass="accent-blue"
        />
        <StatCard
          label="Profit factor"
          value={periodCompletedSignals.length ? (periodGrossLosses > 0 ? (periodGrossWins / periodGrossLosses).toFixed(2) : periodGrossWins > 0 ? periodGrossWins.toFixed(2) : "--") : "--"}
          sub={periodGrossLosses > 0 ? `${formatSignedPrice(periodGrossWins)} frente a -${formatPrice(periodGrossLosses)}` : "Sin pérdidas cerradas para compararlo"}
          toneClass={periodCompletedSignals.length && (periodGrossLosses > 0 ? (periodGrossWins / periodGrossLosses) : periodGrossWins) > 1 ? "portfolio-positive" : periodCompletedSignals.length ? "portfolio-negative" : ""}
          accentClass="accent-emerald"
        />
      </div>
    </div>
  );
}

interface AggregateRow {
  label: string;
  total: number;
  wins: number;
  losses: number;
  invalidated: number;
  pnl: number;
  avgPnl: number;
  winRate: number;
}

function summarizeByKey(signals: SignalSnapshot[], getKey: (signal: SignalSnapshot) => string): AggregateRow[] {
  const buckets = new Map<string, { total: number; wins: number; losses: number; invalidated: number; pnl: number }>();

  signals.forEach((signal) => {
    const key = getKey(signal);
    if (!key) return;
    const bucket = buckets.get(key) || { total: 0, wins: 0, losses: 0, invalidated: 0, pnl: 0 };
    bucket.total += 1;
    bucket.pnl += Number(signal.outcome_pnl || 0);
    if (signal.outcome_status === "win") bucket.wins += 1;
    if (signal.outcome_status === "loss") bucket.losses += 1;
    if (signal.outcome_status === "invalidated") bucket.invalidated += 1;
    buckets.set(key, bucket);
  });

  return Array.from(buckets.entries())
    .map(([label, stats]) => ({
      label,
      total: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      invalidated: stats.invalidated,
      pnl: stats.pnl,
      avgPnl: stats.total ? stats.pnl / stats.total : 0,
      winRate: stats.total ? (stats.wins / stats.total) * 100 : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl || b.winRate - a.winRate || b.total - a.total);
}

function AnalyticsListCard({
  title,
  subtitle,
  items,
  truncateLabel = false,
}: {
  title: string;
  subtitle: string;
  items: AggregateRow[];
  truncateLabel?: boolean;
}) {
  return (
    <div className="signal-analytics-card">
      <div className="signal-analytics-head">
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </div>

      {!items.length ? (
        <p className="section-note">Todavía no hay suficientes señales cerradas para esta lectura.</p>
      ) : (
        <div className="signal-analytics-list">
          {items.map((item, index) => (
            <div key={`${title}-${item.label}`} className="signal-analytics-item">
              <div className="signal-analytics-rank">{index + 1}</div>
              <div className="signal-analytics-copy">
                <strong className={truncateLabel ? "truncate-text" : ""}>{item.label}</strong>
                <span>{item.total} señales · {item.winRate.toFixed(0)}% acierto · {formatSignedPrice(item.avgPnl)} promedio</span>
              </div>
              <div className={`signal-analytics-pnl ${item.pnl > 0 ? "is-positive" : item.pnl < 0 ? "is-negative" : ""}`}>
                {formatSignedPrice(item.pnl)}
              </div>
            </div>
          ))}
        </div>
      )}
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
        <div className="signal-status-block">
          <select className="timeframe-select signal-select" value={outcomeStatus} onChange={(e) => setOutcomeStatus(e.target.value as SignalOutcomeStatus)}>
            <option value="pending">Pendiente</option>
            <option value="win">Ganada</option>
            <option value="loss">Perdida</option>
            <option value="invalidated">Invalidada</option>
          </select>
          <span className="signal-status-note">{describeSignalStatus(signal, outcomeStatus)}</span>
        </div>
      </td>
      <td>
        <div className="signal-pnl-block">
          <input
            className="signal-memory-input"
            value={outcomePnl}
            onChange={(e) => setOutcomePnl(e.target.value)}
            placeholder="0.00"
          />
          <span className={`signal-status-note ${Number(outcomePnl || 0) > 0 ? "is-positive" : Number(outcomePnl || 0) < 0 ? "is-negative" : ""}`}>
            {Number(outcomePnl || 0) !== 0 ? formatSignedPrice(Number(outcomePnl || 0)) : "Sin PnL registrado"}
          </span>
        </div>
      </td>
      <td>
        <div className="signal-note-block">
          <input
            className="signal-memory-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Qué pasó con esta señal"
          />
          <span className="signal-status-note">
            {note.includes("Auto-cerrada")
              ? "Cierre automático detectado"
              : outcomeStatus === "pending"
                ? "Todavía sin cierre"
                : "Cierre marcado manualmente"}
          </span>
        </div>
      </td>
      <td>
        <button className="btn-secondary-soft" type="button" onClick={() => onSave(signal.id, outcomeStatus, Number(outcomePnl || 0), note)}>
          Guardar
        </button>
      </td>
    </tr>
  );
}

function describeSignalStatus(signal: SignalSnapshot, selectedStatus: SignalOutcomeStatus) {
  if (selectedStatus === "pending") {
    return `Abierta desde ${new Date(signal.created_at).toLocaleString("es-DO")}`;
  }

  const closedAt = signal.updated_at || signal.created_at;
  const closeLabel =
    selectedStatus === "win"
      ? "Cerrada en ganancia"
      : selectedStatus === "loss"
        ? "Cerrada en pérdida"
        : "Invalidada";

  return `${closeLabel} el ${new Date(closedAt).toLocaleString("es-DO")}`;
}
