import { COINS, TIMEFRAME_OPTIONS } from "../config/constants";
import { MoonIcon, SunIcon } from "./Icons";
import type { UserSession } from "../types";

interface TopBarProps {
  currentCoin: string;
  timeframe: string;
  status: "idle" | "loading" | "ok" | "error";
  user: UserSession;
  showAdmin: boolean;
  theme: "light" | "dark";
  onCoinChange: (coin: string) => void;
  onTimeframeChange: (timeframe: string) => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export function TopBar(props: TopBarProps) {
  const statusText =
    props.status === "loading" ? "Cargando..." : props.status === "error" ? "Error de conexión" : "Datos correctos";

  return (
    <header className="top-bar">
      <div className="top-left">
        <div className="search-coin">
          <input list="coin-options" value={props.currentCoin} onChange={(e) => props.onCoinChange(e.target.value)} placeholder="Buscar moneda" />
          <datalist id="coin-options">
            {COINS.map((coin) => (
              <option key={coin} value={coin} />
            ))}
          </datalist>
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
