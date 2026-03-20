import { useEffect, useState, type ReactNode } from "react";
import type { UserSession, ViewName } from "../types";

type SidebarLeafItem = {
  kind: "item";
  view: ViewName;
  label: string;
  icon: ReactNode;
  trailing?: ReactNode;
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
  { kind: "item", view: "defi-center", label: "DeFi Center", icon: <HexagonIcon /> },
  { kind: "item", view: "yield-farming", label: "Yield Farming", icon: <SproutIcon /> },
  { kind: "item", view: "staking-pools", label: "Staking Pools", icon: <LayersIcon /> },
  { kind: "item", view: "liquidity-tracker", label: "Liquidity Tracker", icon: <DropsIcon /> },
  { kind: "item", view: "portfolio-tracker", label: "Portfolio Tracker", icon: <PieIcon /> },
  { kind: "item", view: "wallets", label: "Wallets", icon: <CardIcon /> },
  { kind: "item", view: "defi-protocols", label: "DeFi Protocols", icon: <BranchIcon /> },
];

const MARKETPLACE_ITEMS: SidebarEntry[] = [
  { kind: "item", view: "strategies-marketplace", label: "Strategies Marketplace", icon: <StoreIcon /> },
  { kind: "item", view: "bot-templates", label: "Bot Templates", icon: <TemplateIcon /> },
];

const ACCOUNT_ITEMS: SidebarEntry[] = [
  { kind: "item", view: "preferences", label: "Preferences", icon: <SettingsIcon /> },
  { kind: "item", view: "notifications", label: "Notifications", icon: <BellIcon />, trailing: <span className="sidebar-item-badge">5</span> },
  { kind: "item", view: "security-api-keys", label: "Security & API Keys", icon: <ShieldIcon /> },
  { kind: "item", view: "invite-friends", label: "Invite Friends", icon: <UserPlusIcon /> },
  { kind: "item", view: "subscription", label: "Subscription", icon: <CrownIcon />, trailing: <span className="sidebar-item-badge is-pro">PRO</span> },
  { kind: "item", view: "help-center", label: "Help Center", icon: <HelpIcon /> },
];

const SECTION_GROUPS: Array<{ title: string; items: SidebarEntry[] }> = [
  { title: "Main", items: MAIN_ITEMS },
  { title: "Trading & Bots", items: TRADING_ITEMS },
  { title: "DeFi & Portfolio", items: DEFI_ITEMS },
  { title: "Marketplace", items: MARKETPLACE_ITEMS },
  { title: "Account", items: ACCOUNT_ITEMS },
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
              <p>AI Trading Platform</p>
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
                      {item.trailing ? <span className="nav-trailing">{item.trailing}</span> : null}
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

      <div className="sidebar-user sidebar-user-template">
        <div className="sidebar-user-summary">
          <div className="sidebar-user-avatar">{(user.displayName || user.username || "C").slice(0, 2).toUpperCase()}</div>
          <div className="sidebar-user-copy">
            <div className="sidebar-user-name">{user.displayName || user.username}</div>
            <div className="sidebar-user-email">{user.username}@crype.app</div>
          </div>
        </div>
        <div className="sidebar-user-actions">
          <button type="button" className="sidebar-user-link" onClick={() => onViewChange("preferences")}>
            Account Settings
          </button>
          <button type="button" className="sidebar-user-link sidebar-user-link-danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

function SettingsIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3h2l.7 2.2 2.2.9 2-1.2 1.4 1.4-1.2 2 .9 2.2L21 11v2l-2.2.7-.9 2.2 1.2 2-1.4 1.4-2-1.2-2.2.9L13 21h-2l-.7-2.2-2.2-.9-2 1.2-1.4-1.4 1.2-2-.9-2.2L3 13v-2l2.2-.7.9-2.2-1.2-2 1.4-1.4 2 1.2 2.2-.9L11 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 17a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m12 3 7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3Z" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19a4 4 0 0 0-8 0" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 2v6m3-3h-6" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m3 8 5 4 4-6 4 6 5-4-2 11H5L3 8Z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.1 9a3 3 0 1 1 5.8 1c-.4.9-1 1.4-1.8 1.9-.7.4-1.1.8-1.1 1.6V14" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01" />
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
    </svg>
  );
}

function HexagonIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
    </svg>
  );
}

function SproutIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21V10M12 10c0-3 2-5 5-5 0 3-2 5-5 5Zm0 0c0-3-2-5-5-5 0 3 2 5 5 5Z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m12 4 8 4-8 4-8-4 8-4Zm8 8-8 4-8-4m16 4-8 4-8-4" />
    </svg>
  );
}

function DropsIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3c3 4 6 7.1 6 10a6 6 0 1 1-12 0c0-2.9 3-6 6-10Z" />
    </svg>
  );
}

function PieIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v9h9A9 9 0 1 1 12 3Z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 3v12a3 3 0 0 0 3 3h9" />
      <circle cx="6" cy="3" r="2" strokeWidth="2" />
      <circle cx="18" cy="18" r="2" strokeWidth="2" />
      <circle cx="18" cy="6" r="2" strokeWidth="2" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14l-1 11H6L5 8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 8V6a3 3 0 1 1 6 0v2" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5h16v14H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5v14M9 10h11" />
    </svg>
  );
}
