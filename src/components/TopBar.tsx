import { useEffect, useMemo, useRef, useState } from "react";
import { TIMEFRAME_OPTIONS } from "../config/constants";
import { MoonIcon, SunIcon } from "./Icons";
import type { UserSession } from "../types";

interface TopBarProps {
  currentCoin: string;
  coinOptions: string[];
  popularCoins: string[];
  timeframe: string;
  status: "idle" | "loading" | "ok" | "error";
  user: UserSession;
  showAdmin: boolean;
  theme: "light" | "dark";
  onCoinChange: (coin: string) => boolean;
  onTimeframeChange: (timeframe: string) => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export function TopBar(props: TopBarProps) {
  const [query, setQuery] = useState(props.currentCoin);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
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

  useEffect(() => {
    setQuery(props.currentCoin);
  }, [props.currentCoin]);

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
      return;
    }
    setFeedback("");
    setQuery(normalized);
    setIsOpen(false);
  }

  return (
    <header className="top-bar">
      <div className="top-left">
        <div className="search-coin" ref={wrapperRef}>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFeedback("");
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyCoin(query);
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
                filteredCoins.map((coin) => (
                  <button
                    key={coin}
                    type="button"
                    className={`coin-combobox-option${coin === props.currentCoin ? " active" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
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

        <select className="timeframe-select" value={props.timeframe} onChange={(e) => props.onTimeframeChange(e.target.value)}>
          {TIMEFRAME_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button className="btn-primary" onClick={props.onRefresh}>
          Actualizar análisis
        </button>
      </div>

      <div className="top-right">
        <button className="btn-primary theme-toggle" type="button" onClick={props.onToggleTheme} aria-label="Cambiar tema">
          <SunIcon className="sun-icon" />
          <MoonIcon className="moon-icon" />
        </button>

        <div className="user-pill">
          <span className={`status-indicator ${props.status === "loading" ? "loading" : props.status === "error" ? "error" : ""}`} />
          <span>{statusText}</span>
        </div>

        <div className="user-pill">
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
