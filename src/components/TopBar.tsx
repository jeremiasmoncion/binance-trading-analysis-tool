import { useEffect, useMemo, useRef, useState } from "react";
import { BellIcon, BoltIcon, ChevronDownIcon, MoonIcon, PanelLeftIcon, SunIcon } from "./Icons";
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
  sidebarCollapsed: boolean;
  onCoinChange: (coin: string) => boolean;
  onTimeframeChange: (timeframe: string) => void;
  onRefresh: () => void;
  onToggleWatchlist: () => void;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export function TopBar(props: TopBarProps) {
  const [query, setQuery] = useState(props.currentCoin);
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
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
        <button
          className="topbar-sidebar-toggle"
          type="button"
          onClick={props.onToggleSidebar}
          aria-label={props.sidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          <PanelLeftIcon className={props.sidebarCollapsed ? "is-collapsed" : ""} />
        </button>

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
      </div>

      <div className="top-right">
        <div className="topbar-status-shell" title={statusText}>
          <span className={`status-indicator ${props.status === "loading" ? "loading" : props.status === "error" ? "error" : ""}`} />
          <span>{props.status === "loading" ? "Sync" : props.status === "error" ? "Issue" : "Live"}</span>
        </div>

        <button className="topbar-icon-shell utility-highlight" type="button" aria-label="Automatización activa">
          <BoltIcon />
        </button>

        <button className="topbar-icon-shell topbar-alert-shell" type="button" aria-label="Centro de alertas">
          <BellIcon />
          {props.status !== "ok" ? <span className="topbar-alert-badge">{props.status === "error" ? "!" : "1"}</span> : null}
        </button>

        <button className="topbar-icon-shell theme-toggle" type="button" onClick={props.onToggleTheme} aria-label="Cambiar tema">
          <SunIcon className="sun-icon" />
          <MoonIcon className="moon-icon" />
        </button>

        <div className="topbar-user-menu" ref={userMenuRef}>
          <button
            className="topbar-user-shell"
            type="button"
            aria-label="Abrir menú de usuario"
            onClick={() => setIsUserMenuOpen((current) => !current)}
          >
            <span className="topbar-avatar">{(props.user.displayName || props.user.username || "CR").slice(0, 2).toUpperCase()}</span>
            <ChevronDownIcon className={`topbar-user-chevron${isUserMenuOpen ? " open" : ""}`} />
          </button>

          {isUserMenuOpen ? (
            <div className="topbar-user-dropdown">
              <div className="topbar-user-dropdown-head">
                <div className="topbar-user-dropdown-name">{props.user.displayName || props.user.username}</div>
                <div className="topbar-user-dropdown-role">{props.showAdmin ? "Administrador" : "Usuario"} · Main</div>
              </div>
              {props.showAdmin ? (
                <button
                  className="topbar-user-dropdown-action"
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    props.onOpenAdmin();
                  }}
                >
                  Admin
                </button>
              ) : null}
              <button
                className="topbar-user-dropdown-action topbar-user-dropdown-action-danger"
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  props.onLogout();
                }}
              >
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
