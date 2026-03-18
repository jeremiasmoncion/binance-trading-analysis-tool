import type { ReactNode } from "react";
import type { UserSession, ViewName } from "../types";
import { PanelLeftIcon } from "./Icons";

type NavItem = { view: ViewName; label: string; icon: ReactNode };

const NAV_ITEMS: NavItem[] = [
  {
    view: "dashboard",
    label: "Inicio",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    view: "balance",
    label: "Balance",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    view: "memory",
    label: "Señales",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v11a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    view: "market",
    label: "Mercado",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    view: "calculator",
    label: "Calculadora",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    view: "compare",
    label: "Comparar monedas",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    view: "learn",
    label: "Aprender",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    view: "profile",
    label: "Perfil",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

const NAV_GROUPS: Array<{ title: string; views: ViewName[] }> = [
  { title: "Core", views: ["dashboard", "memory", "market"] },
  { title: "Trading Studio", views: ["balance", "calculator", "compare"] },
  { title: "Cuenta", views: ["learn", "profile"] },
];

interface SidebarProps {
  user: UserSession;
  currentView: ViewName;
  collapsed: boolean;
  onViewChange: (view: ViewName) => void;
  onToggleCollapse: () => void;
  onLogout: () => void;
}

export function Sidebar({ user, currentView, collapsed, onViewChange, onToggleCollapse, onLogout }: SidebarProps) {
  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-header-row">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <span className="logo-icon-core">C</span>
            </div>
            <div className="logo-text">
              <h1>CRYPE</h1>
              <p>IA operativa para trading</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            <PanelLeftIcon className={collapsed ? "is-collapsed" : ""} />
          </button>
        </div>
      </div>

      <div className="sidebar-status-strip">
        <div className="sidebar-status-badge">
          <span className="sidebar-status-dot" />
          <span>24/7 activo</span>
        </div>
        <div className="sidebar-status-meta">Señales, IA y watcher en vivo</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="sidebar-group">
            <div className="sidebar-group-title">{group.title}</div>
            <div className="sidebar-group-items">
              {group.views.map((view) => {
                const item = NAV_ITEMS.find((entry) => entry.view === view);
                if (!item) return null;
                return (
                  <div
                    key={item.view}
                    className={`nav-item ${currentView === item.view ? "active" : ""}`}
                    data-view={item.view}
                    onClick={() => onViewChange(item.view)}
                    title={collapsed ? item.label : undefined}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{(user.displayName || user.username || "C").slice(0, 2).toUpperCase()}</div>
        <div className="user-info">
          <div className="name">{user.displayName || user.username}</div>
          <div className="role">{user.role === "admin" ? "Administrador" : "Usuario"} · Entorno vivo</div>
        </div>
        <div className="sidebar-user-pills">
          <span className="sidebar-mini-pill">{user.role === "admin" ? "Admin" : "User"}</span>
          <span className="sidebar-mini-pill sidebar-mini-pill-accent">Main</span>
        </div>
        <button className="btn-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
