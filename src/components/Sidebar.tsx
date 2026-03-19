import { useEffect, useState, type ReactNode } from "react";
import type { UserSession, ViewName } from "../types";

type SidebarLeafItem = {
  kind: "item";
  view: ViewName;
  label: string;
  icon: ReactNode;
};

type SidebarSubmenuItem = {
  kind: "submenu";
  label: string;
  icon: ReactNode;
  children: Array<{ view: ViewName; label: string }>;
};

type SidebarEntry = SidebarLeafItem | SidebarSubmenuItem;

const MAIN_ITEMS: SidebarEntry[] = [
  {
    kind: "item",
    view: "dashboard",
    label: "Dashboard",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 2h6" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "balance",
    label: "Mi billetera",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7.5A2.5 2.5 0 0 1 6.5 5h10A2.5 2.5 0 0 1 19 7.5v9A2.5 2.5 0 0 1 16.5 19h-10A2.5 2.5 0 0 1 4 16.5v-9Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12h3m-1.2 0h.01" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "stats",
    label: "Mi estadística",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18V9m6 9V6m6 12v-4" />
      </svg>
    ),
  },
];

const TRADING_ITEMS: SidebarEntry[] = [
  {
    kind: "item",
    view: "signals",
    label: "Senales",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9a4 4 0 1 1 8 0c0 1.3-.42 2.2-1.2 3l-.8.8v1.2H10v-1.2l-.8-.8A4.2 4.2 0 0 1 8 9Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 18h4m-3 3h2" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "bots",
    label: "Bots",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7V5a3 3 0 0 1 6 0v2m-9 4h12v6.5A2.5 2.5 0 0 1 15.5 20h-7A2.5 2.5 0 0 1 6 17.5V11Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14h.01M15 14h.01M12 14v2.5" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "trading",
    label: "Trading",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 16 9 12l3 3 7-7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h4v4" />
      </svg>
    ),
  },
  {
    kind: "submenu",
    label: "Panel de control",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M7 12h10M10 17h4" />
      </svg>
    ),
    children: [
      { view: "control-overview", label: "Resumen" },
      { view: "control-bots", label: "Configuración de bots" },
      { view: "control-history", label: "Registro de historial" },
    ],
  },
];

const SECTION_GROUPS: Array<{ title: string; items: SidebarEntry[] }> = [
  { title: "Main", items: MAIN_ITEMS },
  { title: "Trading & Bots", items: TRADING_ITEMS },
];

interface SidebarProps {
  user: UserSession;
  currentView: ViewName;
  collapsed: boolean;
  onViewChange: (view: ViewName) => void;
  onLogout: () => void;
}

function isControlView(view: ViewName) {
  return view === "control-overview" || view === "control-bots" || view === "control-history";
}

export function Sidebar({ user, currentView, collapsed, onViewChange, onLogout }: SidebarProps) {
  const [controlOpen, setControlOpen] = useState(isControlView(currentView));

  useEffect(() => {
    if (isControlView(currentView)) {
      setControlOpen(true);
    }
  }, [currentView]);

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-header-row">
          <div className="sidebar-brand-shell">
            <div className="sidebar-brand-icon">
              <span className="logo-icon-core">C</span>
            </div>
            <div className="sidebar-brand-copy">
              <h1>CRYPE</h1>
              <p>IA Trading Platform</p>
            </div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {SECTION_GROUPS.map((group) => (
          <div key={group.title} className="sidebar-group">
            <div className="sidebar-group-title">{group.title}</div>
            <div className="sidebar-group-items">
              {group.items.map((item) => {
                if (item.kind === "item") {
                  return (
                    <button
                      key={item.view}
                      type="button"
                      className={`nav-item ${currentView === item.view ? "active" : ""}`}
                      onClick={() => onViewChange(item.view)}
                      title={collapsed ? item.label : undefined}
                    >
                      {item.icon}
                      <span className="nav-text">{item.label}</span>
                    </button>
                  );
                }

                const submenuActive = item.children.some((child) => child.view === currentView);
                return (
                  <div key={item.label} className={`nav-submenu${submenuActive ? " active" : ""}${controlOpen ? " open" : ""}`}>
                    <button
                      type="button"
                      className={`nav-item nav-item-parent ${submenuActive ? "active" : ""}`}
                      onClick={() => setControlOpen((current) => !current)}
                      title={collapsed ? item.label : undefined}
                    >
                      {item.icon}
                      <span className="nav-text">{item.label}</span>
                      <svg className={`nav-arrow${controlOpen ? " open" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    <div className="nav-submenu-list">
                      {item.children.map((child) => (
                        <button
                          key={child.view}
                          type="button"
                          className={`submenu-item ${currentView === child.view ? "active" : ""}`}
                          onClick={() => onViewChange(child.view)}
                        >
                          <span className="submenu-dot" />
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </div>
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
