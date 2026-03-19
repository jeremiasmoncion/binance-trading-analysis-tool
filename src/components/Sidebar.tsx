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
  id: "dashboard" | "control-panel" | "ai-bot";
  label: string;
  icon: ReactNode;
  children: Array<{ view: ViewName; label: string }>;
};

type SidebarEntry = SidebarLeafItem | SidebarSubmenuItem;

const MAIN_ITEMS: SidebarEntry[] = [
  {
    kind: "submenu",
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 2h6" />
      </svg>
    ),
    children: [{ view: "dashboard", label: "Dashboard" }],
  },
  {
    kind: "item",
    view: "balance",
    label: "My Wallet",
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
    label: "My Statistics",
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
    id: "control-panel",
    label: "Control Panel",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M7 12h10M10 17h4" />
      </svg>
    ),
    children: [
      { view: "control-overview", label: "Overview" },
      { view: "control-bot-settings", label: "Bot Settings" },
      { view: "control-execution-logs", label: "Execution Logs" },
    ],
  },
  {
    kind: "submenu",
    id: "ai-bot",
    label: "AI Bot",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7V5a3 3 0 0 1 6 0v2m-8 3h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14h.01M15 14h.01M12 14v1.5" />
      </svg>
    ),
    children: [
      { view: "ai-signal-bot", label: "Signal Bot" },
      { view: "ai-dca-bot", label: "DCA Bot" },
      { view: "ai-arbitrage-bot", label: "Arbitrage Bot" },
      { view: "ai-pump-screener", label: "Pump Screener" },
    ],
  },
];

const DEFI_ITEMS: SidebarEntry[] = [
  {
    kind: "item",
    view: "defi-center",
    label: "DeFi Center",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m12 7 4 2v6l-4 2-4-2V9l4-2Z" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "yield-farming",
    label: "Yield Farming",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 14c0-3.5 2.6-6 5-8 2.4 2 5 4.5 5 8a5 5 0 1 1-10 0Z" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "staking-pools",
    label: "Staking Pools",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 12h12M8 7h8M8 17h8" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "liquidity-tracker",
    label: "Liquidity Tracker",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18 18 6M8 6h10v10" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "portfolio-tracker",
    label: "Portfolio Tracker",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 19h16M7 16V8m5 8V5m5 11v-6" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "wallets",
    label: "Wallets",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 8V6a2 2 0 0 1 2-2h6" />
      </svg>
    ),
  },
  {
    kind: "item",
    view: "defi-protocols",
    label: "DeFi Protocols",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16M4 12h16M7 7l10 10M17 7 7 17" />
      </svg>
    ),
  },
];

const MARKETPLACE_ITEMS: SidebarEntry[] = [
  {
    kind: "item",
    view: "strategies-marketplace",
    label: "Strategies Marketplace",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 7h14l-1 11H6L5 7Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10V7a3 3 0 1 1 6 0v3" />
      </svg>
    ),
  },
];

const SECTION_GROUPS: Array<{ title: string; items: SidebarEntry[] }> = [
  { title: "MAIN", items: MAIN_ITEMS },
  { title: "TRADING & BOTS", items: TRADING_ITEMS },
  { title: "DEFI & PORTFOLIO", items: DEFI_ITEMS },
  { title: "MARKETPLACE", items: MARKETPLACE_ITEMS },
];

const SUBMENU_VIEWS: Record<SidebarSubmenuItem["id"], ViewName[]> = {
  dashboard: ["dashboard"],
  "control-panel": ["control-overview", "control-bot-settings", "control-execution-logs"],
  "ai-bot": ["ai-signal-bot", "ai-dca-bot", "ai-arbitrage-bot", "ai-pump-screener"],
};

function buildInitialOpenState(view: ViewName) {
  return {
    dashboard: SUBMENU_VIEWS.dashboard.includes(view),
    "control-panel": SUBMENU_VIEWS["control-panel"].includes(view),
    "ai-bot": SUBMENU_VIEWS["ai-bot"].includes(view),
  };
}

interface SidebarProps {
  user: UserSession;
  currentView: ViewName;
  collapsed: boolean;
  onViewChange: (view: ViewName) => void;
  onLogout: () => void;
}

export function Sidebar({ user, currentView, collapsed, onViewChange, onLogout }: SidebarProps) {
  const [openState, setOpenState] = useState(() => buildInitialOpenState(currentView));

  useEffect(() => {
    setOpenState((current) => ({
      ...current,
      dashboard: current.dashboard || SUBMENU_VIEWS.dashboard.includes(currentView),
      "control-panel": current["control-panel"] || SUBMENU_VIEWS["control-panel"].includes(currentView),
      "ai-bot": current["ai-bot"] || SUBMENU_VIEWS["ai-bot"].includes(currentView),
    }));
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
                const submenuOpen = openState[item.id];

                return (
                  <div key={item.id} className={`nav-submenu${submenuActive ? " active" : ""}${submenuOpen ? " open" : ""}`}>
                    <button
                      type="button"
                      className={`nav-item nav-item-parent ${submenuActive ? "active" : ""}`}
                      onClick={() => setOpenState((current) => ({ ...current, [item.id]: !current[item.id] }))}
                      title={collapsed ? item.label : undefined}
                    >
                      {item.icon}
                      <span className="nav-text">{item.label}</span>
                      <svg className={`nav-arrow${submenuOpen ? " open" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
