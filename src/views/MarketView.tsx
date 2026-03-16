import { useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { formatPrice } from "../lib/format";
import type { Indicators, Signal, WatchlistGroup } from "../types";

interface MarketViewProps {
  currentCoin: string;
  watchlists: WatchlistGroup[];
  watchlist: string[];
  activeWatchlistName: string;
  signal: Signal | null;
  indicators: Indicators | null;
  market24h: {
    change: number;
    high: number;
    low: number;
    volume: string;
    updatedAt: string;
  };
  support: number;
  resistance: number;
  onSelectCoin: (coin: string) => void;
  onToggleWatchlist: (coin: string) => void;
  onCreateWatchlist: (name: string) => Promise<void>;
  onRenameWatchlist: (name: string, nextName: string) => Promise<void>;
  onDeleteWatchlist: (name: string) => Promise<void>;
  onSetActiveWatchlist: (name: string) => Promise<void>;
}

export function MarketView(props: MarketViewProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "watchlist">("summary");
  const signal = props.signal;
  const indicators = props.indicators;

  return (
    <div id="marketView" className="view-panel active">
      <SectionCard title="Lectura de mercado" subtitle="Señal principal, indicadores y contexto técnico del activo seleccionado." />

      <ModuleTabs
        items={[
          { key: "summary", label: "Resumen" },
          { key: "watchlist", label: "Watchlist" },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as "summary" | "watchlist")}
      />

      {activeTab === "summary" ? (
        <>
          <div className="stats-grid">
            <StatCard label="Cambio 24h" value={`${props.market24h.change.toFixed(2)}%`} toneClass={props.market24h.change >= 0 ? "positive" : "negative"} sub="Variación del día" />
            <StatCard label="Máximo / Mínimo 24h" value={`${formatPrice(props.market24h.high)} / ${formatPrice(props.market24h.low)}`} sub="Rango donde se ha movido hoy" />
            <StatCard label="Volumen 24h" value={props.market24h.volume} sub="Entre más volumen, más participación" />
            <StatCard label="Última actualización" value={props.market24h.updatedAt} sub="Datos en vivo" />
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Señal principal</div>
                <div className="card-subtitle">La idea es ayudarte a decidir antes de tocar el botón de compra o venta.</div>
              </div>
            </div>
            <span className="decision-label">{signal?.label || "Esperar"}</span>
            <h3 className="market-title">{signal?.title || "Esperar confirmación"}</h3>
            <p className="market-copy">{signal?.reasons.join(" ") || "Esperando datos."}</p>
            <div className="market-pill-row">
              <span className="market-pill">{props.currentCoin}</span>
            </div>
            <div className="market-score">
              <div className="market-score-head">
                <span>Fuerza de la lectura</span>
                <span>{signal ? `${signal.score}%` : "0%"}</span>
              </div>
              <div className="market-score-track">
                <div className="market-score-fill" style={{ width: `${signal?.score || 0}%` }} />
              </div>
            </div>
            <ul className="market-reason-list">
              {(signal?.reasons || ["El mercado sigue recopilando contexto."]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <details className="card details-card">
            <summary className="details-summary">Indicadores técnicos (clic para ver)</summary>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="label">RSI (14)</div>
                <div className="value">{indicators ? indicators.rsi.toFixed(1) : "50.0"}</div>
                <div className="sub">
                  {indicators ? (indicators.rsi < 30 ? "Sobreventa" : indicators.rsi > 70 ? "Sobrecompra" : "Neutral") : "Neutral"}
                </div>
              </div>
              <div className="stat-card">
                <div className="label">MACD</div>
                <div className="value">{indicators?.macd || "Neutral"}</div>
                <div className="sub">Cruce de líneas</div>
              </div>
              <div className="stat-card">
                <div className="label">Media Corta (SMA 20)</div>
                <div className="value">{formatPrice(indicators?.sma20 || 0)}</div>
                <div className="sub">Tendencia corto plazo</div>
              </div>
              <div className="stat-card">
                <div className="label">Media Larga (SMA 50)</div>
                <div className="value">{formatPrice(indicators?.sma50 || 0)}</div>
                <div className="sub">Tendencia medio plazo</div>
              </div>
            </div>
          </details>

          <details className="card details-card">
            <summary className="details-summary">Soporte y resistencia (clic para ver)</summary>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="label">Soporte cercano</div>
                <div className="value">{formatPrice(props.support || 0)}</div>
                <div className="sub">Nivel donde el precio podría rebotar al alza</div>
              </div>
              <div className="stat-card">
                <div className="label">Resistencia cercana</div>
                <div className="value">{formatPrice(props.resistance || 0)}</div>
                <div className="sub">Nivel donde el precio podría frenarse</div>
              </div>
            </div>
          </details>
        </>
      ) : null}

      {activeTab === "watchlist" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Lista de seguimiento</div>
              <div className="card-subtitle">Gestiona tus listas de seguimiento y decide cuál usa el sistema como lista activa para análisis y señales.</div>
            </div>
            <div className="market-pill">{props.watchlist.length} en {props.activeWatchlistName}</div>
          </div>
          <div className="watchlist-toolbar">
            <div className="watchlist-list-tabs">
              {props.watchlists.map((list) => (
                <button
                  key={list.name}
                  type="button"
                  className={`watchlist-list-tab${list.name === props.activeWatchlistName ? " active" : ""}`}
                  onClick={() => void props.onSetActiveWatchlist(list.name)}
                >
                  <span>{list.name}</span>
                  <strong>{list.coins.length}</strong>
                </button>
              ))}
            </div>
            <div className="watchlist-actions">
              <button
                type="button"
                className="btn-primary btn-small"
                onClick={() => {
                  const name = window.prompt("Nombre de la nueva lista", "");
                  if (name) void props.onCreateWatchlist(name);
                }}
              >
                Nueva lista
              </button>
              <button
                type="button"
                className="btn-secondary-soft btn-small"
                onClick={() => {
                  const name = window.prompt("Renombrar lista", props.activeWatchlistName);
                  if (name) void props.onRenameWatchlist(props.activeWatchlistName, name);
                }}
              >
                Renombrar
              </button>
              <button
                type="button"
                className="btn-secondary-soft btn-small danger"
                disabled={props.watchlists.length <= 1}
                onClick={() => {
                  if (window.confirm(`Eliminar la lista ${props.activeWatchlistName}?`)) {
                    void props.onDeleteWatchlist(props.activeWatchlistName);
                  }
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
          {props.watchlist.length ? (
            <div className="watchlist-grid">
              {props.watchlist.map((coin) => (
                <div className={`watchlist-chip${coin === props.currentCoin ? " active" : ""}`} key={coin}>
                  <button type="button" className="watchlist-chip-main" onClick={() => props.onSelectCoin(coin)}>
                    <span className="watchlist-chip-symbol">{coin}</span>
                    <span className="watchlist-chip-note">{coin === props.currentCoin ? "Par activo" : "Abrir en el análisis"}</span>
                  </button>
                  <button
                    type="button"
                    className="watchlist-chip-remove"
                    aria-label={`Quitar ${coin} del watchlist`}
                    onClick={() => props.onToggleWatchlist(coin)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-subtitle">Esta lista todavía no tiene monedas. Usa la estrella de arriba para agregar el par actual a la lista activa.</div>
          )}
        </section>
      ) : null}
    </div>
  );
}
