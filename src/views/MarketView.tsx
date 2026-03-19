import { useEffect, useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { PaginationControls, paginateRows } from "../components/ui/PaginationControls";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useMarketSummarySelector, useWatchlistSelector } from "../data-platform/selectors";
import { formatPrice } from "../lib/format";
import type { Indicators, Signal, WatchlistGroup } from "../types";

interface MarketViewProps {
  currentCoin?: string;
  watchlists?: WatchlistGroup[];
  watchlist?: string[];
  activeWatchlistName?: string;
  signal?: Signal | null;
  indicators?: Indicators | null;
  market24h?: {
    change: number;
    high: number;
    low: number;
    volume: string;
    updatedAt: string;
  };
  support?: number;
  resistance?: number;
  onSelectCoin: (coin: string) => void;
  onToggleWatchlist: (coin: string) => void;
  onReplaceWatchlistCoins: (name: string, coins: string[]) => Promise<void>;
  onCreateWatchlist: (name: string) => Promise<void>;
  onRenameWatchlist: (name: string, nextName: string) => Promise<void>;
  onDeleteWatchlist: (name: string) => Promise<void>;
  onSetActiveWatchlist: (name: string) => Promise<void>;
}

export function MarketView(incomingProps: MarketViewProps) {
  const marketData = useMarketSummarySelector();
  const systemData = useWatchlistSelector();
  const props: MarketViewProps = {
    ...incomingProps,
    currentCoin: incomingProps.currentCoin ?? marketData.currentCoin,
    watchlists: incomingProps.watchlists ?? systemData.watchlists,
    watchlist: incomingProps.watchlist ?? (systemData.watchlists.find((item) => item.name === systemData.activeWatchlistName)?.coins || []),
    activeWatchlistName: incomingProps.activeWatchlistName ?? systemData.activeWatchlistName,
    signal: incomingProps.signal ?? marketData.signal,
    indicators: incomingProps.indicators ?? marketData.indicators,
    market24h: incomingProps.market24h ?? marketData.market24h,
    support: incomingProps.support ?? marketData.support,
    resistance: incomingProps.resistance ?? marketData.resistance,
  };
  const [activeTab, setActiveTab] = useState<"summary" | "watchlist">("summary");
  const watchlists = props.watchlists || [];
  const activeWatchlistName = props.activeWatchlistName || systemData.activeWatchlistName;
  const currentCoin = props.currentCoin || marketData.currentCoin;
  const signal = props.signal || null;
  const indicators = props.indicators || null;
  const market24h = props.market24h || marketData.market24h;
  const support = props.support || 0;
  const resistance = props.resistance || 0;
  const [selectedListName, setSelectedListName] = useState(activeWatchlistName);
  const [watchlistPage, setWatchlistPage] = useState(1);
  const selectedList = useMemo(
    () => watchlists.find((item) => item.name === selectedListName) || watchlists.find((item) => item.name === activeWatchlistName) || watchlists[0] || null,
    [watchlists, selectedListName, activeWatchlistName],
  );
  const selectedCoins = selectedList?.coins || [];
  const selectedIsActive = selectedList?.name === activeWatchlistName;
  const pagedSelectedCoins = useMemo(() => paginateRows(selectedCoins, watchlistPage), [selectedCoins, watchlistPage]);

  useEffect(() => {
    if (!watchlists.some((item) => item.name === selectedListName)) {
      setSelectedListName(activeWatchlistName);
    }
  }, [watchlists, activeWatchlistName, selectedListName]);

  useEffect(() => {
    setWatchlistPage(1);
  }, [selectedListName, selectedCoins.length]);

  return (
    <div id="marketView" className="view-panel active">
      <SectionCard
        title="Lectura de mercado"
        subtitle="Señal principal, indicadores y contexto técnico del activo seleccionado."
        helpTitle="Cómo leer Mercado"
        helpBody="Esta vista te ayuda a validar el par actual antes de operar. Combina una lectura rápida del día, una señal principal y los indicadores técnicos más útiles."
        helpBullets={[
          "Arriba ves el pulso rápido del día: cambio, rango, volumen y última actualización.",
          "En Señal principal el sistema resume la idea dominante del momento.",
          "Abajo puedes abrir indicadores y niveles para revisar más detalle sin llenar la pantalla.",
        ]}
      />

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
            <StatCard
              label="Cambio 24h"
              value={`${market24h.change.toFixed(2)}%`}
              toneClass={market24h.change >= 0 ? "positive" : "negative"}
              sub="Variación del día"
              helpTitle="Cambio 24h"
              helpBody="Te dice cuánto ha subido o bajado el precio durante las últimas 24 horas. Sirve para entender el tono general del día, no para tomar una decisión por sí solo."
            />
            <StatCard
              label="Máximo / Mínimo 24h"
              value={`${formatPrice(market24h.high)} / ${formatPrice(market24h.low)}`}
              sub="Rango donde se ha movido hoy"
              helpTitle="Máximo y mínimo 24h"
              helpBody="Este rango te ayuda a saber si el precio actual está más cerca de la parte alta o baja del día. Es útil para detectar si ya corrió demasiado o si todavía tiene espacio."
            />
            <StatCard
              label="Volumen 24h"
              value={market24h.volume}
              sub="Entre más volumen, más participación"
              helpTitle="Volumen 24h"
              helpBody="El volumen refleja cuánta actividad tuvo el activo. Cuando un movimiento viene acompañado de mejor volumen, normalmente se siente más confiable."
            />
            <StatCard
              label="Última actualización"
              value={market24h.updatedAt}
              sub="Datos en vivo"
              helpTitle="Última actualización"
              helpBody="Te muestra cuándo se refrescaron por última vez estos datos de mercado. Sirve para confirmar que estás leyendo información reciente."
            />
          </div>

          <SectionCard
            title="Señal principal"
            subtitle="La idea es ayudarte a decidir antes de tocar el botón de compra o venta."
            helpTitle="Señal principal"
            helpBody="Es la lectura más importante que el sistema está viendo para el par actual. Resume la idea dominante y te orienta antes de revisar el plan completo en Inicio o ejecutar algo."
            helpBullets={[
              "Comprar: el sistema ve una oportunidad favorable.",
              "Vender: detecta presión bajista o contexto defensivo.",
              "Esperar: no hay suficiente claridad para justificar entrada.",
            ]}
          >
            <span className="decision-label">{signal?.label || "Esperar"}</span>
            <h3 className="market-title">{signal?.title || "Esperar confirmación"}</h3>
            <p className="market-copy">{signal?.reasons.join(" ") || "Esperando datos."}</p>
            <div className="market-pill-row">
              <span className="market-pill">{currentCoin}</span>
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
          </SectionCard>

          <SectionCard
            className="details-shell"
            title="Indicadores técnicos"
            subtitle="Abre este bloque para revisar el estado de RSI, MACD y medias."
            helpTitle="Indicadores técnicos"
            helpBody="Aquí tienes los indicadores que más usamos para leer impulso y tendencia. No se trata de memorizar fórmulas, sino de usar este bloque para entender si el mercado se ve acelerado, cansado o neutral."
            helpBullets={[
              "RSI: mide si el activo parece muy extendido al alza o a la baja.",
              "MACD: ayuda a detectar cambios de impulso.",
              "SMA 20 y SMA 50: muestran tendencia corta y media.",
            ]}
          >
            <details className="details-card">
              <summary className="details-summary">Mostrar indicadores técnicos</summary>
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
          </SectionCard>

          <SectionCard
            className="details-shell"
            title="Soporte y resistencia"
            subtitle="Abre este bloque para ver las zonas donde el precio podría defenderse o frenarse."
            helpTitle="Soporte y resistencia"
            helpBody="Estos niveles te ayudan a ubicar mejor la entrada. Sirven para saber si el precio tiene espacio para avanzar o si ya está muy pegado a una zona donde podría frenarse."
            helpBullets={[
              "Soporte: zona donde el precio podría rebotar.",
              "Resistencia: zona donde el precio podría toparse con presión.",
            ]}
          >
            <details className="details-card">
              <summary className="details-summary">Mostrar soporte y resistencia</summary>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="label">Soporte cercano</div>
                  <div className="value">{formatPrice(support)}</div>
                  <div className="sub">Nivel donde el precio podría rebotar al alza</div>
                </div>
                <div className="stat-card">
                  <div className="label">Resistencia cercana</div>
                  <div className="value">{formatPrice(resistance)}</div>
                  <div className="sub">Nivel donde el precio podría frenarse</div>
                </div>
              </div>
            </details>
          </SectionCard>
        </>
      ) : null}

      {activeTab === "watchlist" ? (
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Lista de seguimiento</div>
              <div className="card-subtitle">Selecciona una lista para verla o editarla. Luego marca explícitamente cuál alimenta las señales automáticas y el vigilante del mercado.</div>
            </div>
            <div className="watchlist-active-pill">
              <span className="watchlist-active-label">Lista activa para señales</span>
              <strong>{activeWatchlistName}</strong>
            </div>
          </div>
          <div className="watchlist-status-banner">
            <div>
              <div className="watchlist-status-title">
                {selectedList?.name || "Lista"} {selectedIsActive ? "alimenta el sistema" : "está en edición"}
              </div>
              <div className="card-subtitle">
                {selectedIsActive
                  ? "El vigilante y las señales automáticas usan esta lista para revisar el mercado aunque no tengas la app abierta."
                  : "Puedes revisar y organizar esta lista sin cambiar el motor. Si quieres que el sistema la use, actívala con el botón de abajo."}
              </div>
            </div>
            {selectedList ? (
              selectedIsActive ? (
                <span className="watchlist-status-chip active">Activa para señales</span>
              ) : (
                <button type="button" className="btn-primary btn-small" onClick={() => void props.onSetActiveWatchlist(selectedList.name)}>
                  Usar esta lista para señales
                </button>
              )
            ) : null}
          </div>
          <div className="watchlist-toolbar">
            <div className="watchlist-list-tabs">
              {watchlists.map((list) => (
                <button
                  key={list.name}
                  type="button"
                  className={`watchlist-list-tab${list.name === selectedList?.name ? " active" : ""}`}
                  onClick={() => setSelectedListName(list.name)}
                >
                  <span>{list.name}</span>
                  <strong>{list.coins.length}</strong>
                  {list.name === activeWatchlistName ? <em>Activa</em> : null}
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
                  const currentName = selectedList?.name || activeWatchlistName;
                  const name = window.prompt("Renombrar lista", currentName);
                  if (name) void props.onRenameWatchlist(currentName, name);
                }}
              >
                Renombrar
              </button>
              <button
                type="button"
                className="btn-secondary-soft btn-small danger"
                disabled={watchlists.length <= 1}
                onClick={() => {
                  const currentName = selectedList?.name || activeWatchlistName;
                  if (window.confirm(`Eliminar la lista ${currentName}?`)) {
                    void props.onDeleteWatchlist(currentName);
                  }
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
          {selectedCoins.length ? (
            <>
              <div className="watchlist-grid">
              {pagedSelectedCoins.rows.map((coin) => (
                <div className={`watchlist-chip${coin === currentCoin ? " active" : ""}`} key={coin}>
                  <button type="button" className="watchlist-chip-main" onClick={() => props.onSelectCoin(coin)}>
                    <span className="watchlist-chip-symbol">{coin}</span>
                    <span className="watchlist-chip-note">{coin === currentCoin ? "Par activo" : "Abrir en el análisis"}</span>
                  </button>
                  <button
                    type="button"
                    className="watchlist-chip-remove"
                    aria-label={`Quitar ${coin} del watchlist`}
                    onClick={() => void props.onReplaceWatchlistCoins(selectedList?.name || activeWatchlistName, selectedCoins.filter((item) => item !== coin))}
                  >
                    ×
                  </button>
                </div>
              ))}
              </div>
              <PaginationControls
                currentPage={pagedSelectedCoins.safePage}
                totalPages={pagedSelectedCoins.totalPages}
                totalItems={selectedCoins.length}
                label="monedas"
                onPageChange={setWatchlistPage}
              />
            </>
          ) : (
            <div className="card-subtitle">Esta lista todavía no tiene monedas. Usa la estrella de arriba para agregar el par actual a la lista que esté activa, o actívala primero si quieres que alimente las señales.</div>
          )}
        </section>
      ) : null}
    </div>
  );
}
