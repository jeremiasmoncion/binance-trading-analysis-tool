import { useEffect, useMemo, useRef, useState } from "react";
import { TIMEFRAME_OPTIONS } from "../config/constants";
import { BellIcon, BoltIcon, MoonIcon, SparklesIcon, StarIcon, SunIcon } from "./Icons";
import type { UserSession } from "../types";

interface TopBarProps {
  currentView: string;
  currentCoin: string;
  coinOptions: string[];
  popularCoins: string[];
  watchlist: string[];
  isCurrentCoinWatched: boolean;
  timeframe: string;
  status: "idle" | "loading" | "ok" | "error";
  user: UserSession;
  showAdmin: boolean;
  theme: "light" | "dark";
  onCoinChange: (coin: string) => boolean;
  onTimeframeChange: (timeframe: string) => void;
  onRefresh: () => void;
  onToggleWatchlist: () => void;
  onToggleTheme: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

const VIEW_META: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Centro de mando",
    subtitle: "Lectura general del mercado, señal principal y pulso del sistema.",
  },
  memory: {
    title: "Señales e IA",
    subtitle: "Motor adaptativo, ejecución demo y gobernanza del edge en vivo.",
  },
  market: {
    title: "Radar de mercado",
    subtitle: "Watchlists, contexto y exploración rápida de pares y marcos.",
  },
  balance: {
    title: "Balance operativo",
    subtitle: "Capital, PnL y lectura general de la cuenta conectada.",
  },
  calculator: {
    title: "Calculadora táctica",
    subtitle: "Tamaño, riesgo y estructura de la operación antes de entrar.",
  },
  compare: {
    title: "Comparador",
    subtitle: "Monedas, momentum y fuerza relativa para decidir mejor.",
  },
  learn: {
    title: "Aprendizaje",
    subtitle: "Base de apoyo para entender mejor el flujo del sistema.",
  },
  profile: {
    title: "Perfil y control",
    subtitle: "Cuenta, Binance, backtesting y paneles de administración.",
  },
};

export function TopBar(props: TopBarProps) {
  const [query, setQuery] = useState(props.currentCoin);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const statusText =
    props.status === "loading" ? "Cargando..." : props.status === "error" ? "Error de conexión" : "Datos correctos";
  const filteredCoins = useMemo(() => {
    const normalized = query.trim().toUpperCase().replace(/\s+/g, "");
    const source = normalized
      ? props.coinOptions.filter((coin) => coin.includes(normalized))
      : props.popularCoins;
    return source.slice(0, 10);
  }, [props.coinOptions, props.popularCoins, query]);
  const viewMeta = VIEW_META[props.currentView] || VIEW_META.dashboard;

  useEffect(() => {
    setQuery(props.currentCoin);
  }, [props.currentCoin]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function applyCoin(nextCoin: string) {
    const normalized = nextCoin.trim().toUpperCase();
    const ok = props.onCoinChange(normalized);
    if (!ok) {
      setFeedback("Ese par no existe en Binance Spot");
      setIsOpen(true);
      return;
    }
    setFeedback("");
    setQuery(normalized);
    setIsOpen(false);
  }

  return (
    <header className="top-bar">
      <div className="top-left">
        <div className="topbar-title-block">
          <div className="topbar-title-row">
            <div className="topbar-live-pill">
              <span className={`status-indicator ${props.status === "loading" ? "loading" : props.status === "error" ? "error" : ""}`} />
              <span>{props.status === "loading" ? "Sincronizando" : props.status === "error" ? "Con incidencia" : "Live"}</span>
            </div>
            <div className="topbar-coin-pill">{props.currentCoin}</div>
          </div>
          <div className="topbar-headline">{viewMeta.title}</div>
          <div className="topbar-subcopy">{viewMeta.subtitle}</div>
        </div>

        <div className="search-coin" ref={wrapperRef}>
          {query ? (
            <button
              type="button"
              className="coin-clear-btn"
              aria-label="Limpiar búsqueda"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery("");
                setFeedback("");
                setIsOpen(true);
              }}
            >
              ×
            </button>
          ) : null}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFeedback("");
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIsOpen(true);
                if (!filteredCoins.length) return;
                setActiveIndex((current) => (current + 1) % filteredCoins.length);
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIsOpen(true);
                if (!filteredCoins.length) return;
                setActiveIndex((current) => (current - 1 + filteredCoins.length) % filteredCoins.length);
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (isOpen && filteredCoins[activeIndex]) {
                  applyCoin(filteredCoins[activeIndex]);
                } else {
                  applyCoin(query);
                }
              }
              if (e.key === "Escape") {
                setIsOpen(false);
              }
            }}
            placeholder="Busca un par, ej. BTC/USDT"
            spellCheck={false}
          />
          {isOpen ? (
            <div className="coin-combobox-menu">
              <div className="coin-combobox-head">{query.trim() ? "Resultados" : "Populares en Binance"}</div>
              {filteredCoins.length ? (
                filteredCoins.map((coin, index) => (
                  <button
                    key={coin}
                    type="button"
                    className={`coin-combobox-option${index === activeIndex ? " active" : ""}${coin === props.currentCoin ? " current" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => applyCoin(coin)}
                  >
                    {coin}
                  </button>
                ))
              ) : (
                <div className="coin-combobox-empty">No encontramos ese par en Binance Spot.</div>
              )}
            </div>
          ) : null}
          {feedback ? <div className="coin-combobox-feedback">{feedback}</div> : null}
        </div>

        <button
          className={`btn-primary watchlist-toggle${props.isCurrentCoinWatched ? " active" : ""}`}
          type="button"
          onClick={props.onToggleWatchlist}
          title={props.isCurrentCoinWatched ? "Quitar del watchlist" : "Agregar al watchlist"}
          aria-label={props.isCurrentCoinWatched ? "Quitar del watchlist" : "Agregar al watchlist"}
        >
          <StarIcon className="watchlist-icon" />
          <span>{props.isCurrentCoinWatched ? "En watchlist" : "Vigilar"}</span>
        </button>

        <select className="timeframe-select" value={props.timeframe} onChange={(e) => props.onTimeframeChange(e.target.value)}>
          {TIMEFRAME_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button className="btn-primary" onClick={props.onRefresh}>
          <SparklesIcon className="topbar-inline-icon" />
          Actualizar análisis
        </button>
      </div>

      <div className="top-right">
        <div className="user-pill watchlist-pill">
          <span>{props.watchlist.length} en watchlist</span>
        </div>

        <button className="topbar-icon-btn utility-highlight" type="button" aria-label="Automatización activa">
          <BoltIcon />
        </button>

        <button className="topbar-icon-btn" type="button" aria-label="Centro de alertas">
          <BellIcon />
        </button>

        <button className="btn-primary theme-toggle topbar-icon-btn" type="button" onClick={props.onToggleTheme} aria-label="Cambiar tema">
          <SunIcon className="sun-icon" />
          <MoonIcon className="moon-icon" />
        </button>

        <div className="user-pill topbar-status-pill">
          <span className={`status-indicator ${props.status === "loading" ? "loading" : props.status === "error" ? "error" : ""}`} />
          <span>{statusText}</span>
        </div>

        <div className="user-pill topbar-user-pill">
          <span>
            Usuario: <strong>{props.user.displayName || props.user.username}</strong>
          </span>
        </div>

        {props.showAdmin ? (
          <button className="btn-primary" onClick={props.onOpenAdmin}>
            Admin
          </button>
        ) : null}

        <button className="btn-primary" onClick={props.onLogout}>
          Salir
        </button>
      </div>
    </header>
  );
}
