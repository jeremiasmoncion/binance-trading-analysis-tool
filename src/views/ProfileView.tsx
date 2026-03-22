import { useEffect, useState, type ReactNode } from "react";
import { PaginationControls, paginateRows } from "../components/ui/PaginationControls";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useProfileSystemSelector } from "../data-platform/selectors";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import { showToast } from "../lib/ui-events";
import type { UserSession, WatchlistScanExecution } from "../types";

interface ProfileViewProps {
  user: UserSession;
  initialTab?: "account" | "binance" | "notifications" | "security" | "users" | "backtesting" | "scanner";
}

const PROFILE_TABS: Array<{
  key: "account" | "notifications" | "security" | "users" | "backtesting" | "scanner";
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}> = [
  { key: "account", label: "Cuenta", icon: <ProfileTabIcon /> },
  { key: "notifications", label: "Notifications", icon: <BellIconMini /> },
  { key: "security", label: "Security & API Keys", icon: <ApiConnectionsIcon /> },
  { key: "scanner", label: "Vigilante", icon: <ScannerTabIcon />, adminOnly: true },
  { key: "backtesting", label: "Backtesting", icon: <BacktestingTabIcon />, adminOnly: true },
  { key: "users", label: "Usuarios", icon: <UsersTabIcon />, adminOnly: true },
];

export function ProfileView(props: ProfileViewProps) {
  const systemData = useProfileSystemSelector();
  const botReadModel = useSignalsBotsReadModel();
  const [activeTab, setActiveTab] = useState<"account" | "binance" | "notifications" | "security" | "users" | "backtesting" | "scanner">(
    props.initialTab === "binance" ? "security" : (props.initialTab || "account"),
  );
  const [usersPage, setUsersPage] = useState(1);
  const [scannerExecution, setScannerExecution] = useState<WatchlistScanExecution | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [datasetBackfillRunning, setDatasetBackfillRunning] = useState(false);
  const [backtestQueueRunning, setBacktestQueueRunning] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [lastBackfillSummary, setLastBackfillSummary] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [accountSettings, setAccountSettings] = useState(() => loadAccountSettings(props.user.username));
  const [notificationSettings, setNotificationSettings] = useState(() => loadNotificationSettings(props.user.username));
  const [storageUsageBytes, setStorageUsageBytes] = useState(0);
  // Profile keeps the authenticated user as an explicit prop, but all mutable
  // operational/admin state now comes from the shared system plane.
  const connection = systemData.connection || null;
  const binanceForm = systemData.binanceForm || { alias: "", apiKey: "", apiSecret: "" };
  const onBinanceFormChange = systemData.setBinanceFormField || (() => undefined);
  const onConnect = systemData.connectBinance || (() => undefined);
  const onRefresh = systemData.refreshProfileDataWithFeedback || (() => undefined);
  const onDisconnect = systemData.disconnectBinance || (() => undefined);
  const onRefreshScannerStatus = systemData.refreshScannerStatus || (async () => null);
  const onRunScannerNow = systemData.runScannerNow || (async () => null);
  const onRefreshValidationLab = systemData.refreshValidationLab || (async () => null);
  const onEnqueueValidationBacktest = systemData.enqueueValidationBacktest || (async () => null);
  const onProcessValidationBacktestQueue = systemData.processValidationBacktestQueue || (async () => null);
  const onBackfillValidationDataset = systemData.backfillValidationDataset || (async () => null);
  const scannerStatus = systemData.scannerStatus;
  const validationReport = systemData.validationReport;
  const backtestRuns = systemData.backtestRuns;
  const backtestQueue = systemData.backtestQueue;
  const signalMemoryCount = systemData.signalMemoryCount || 0;
  const watchlistsCount = systemData.watchlistsCount || 0;
  const summary = connection?.summary || {};
  const users = systemData.availableUsers || [];
  const pagedUsers = paginateRows(users, usersPage);
  const realtimeCore = systemData.realtimeCore;
  const tabs = PROFILE_TABS.filter((tab) => !tab.adminOnly || props.user.role === "admin");

  const profileEmail = `${props.user.username}@crype.app`;
  const connectionStatus = connection?.connected ? "Connected" : "Pending";
  const runtimeLane = realtimeCore.activeMode === "external" ? "External realtime core" : "Serverless fallback";
  const connectionCards = connection?.connected ? [{
    id: "binance-demo",
    name: "Binance Demo",
    accountLabel: connection.accountAlias || "Demo account",
    maskedKey: connection.maskedApiKey || "API activa",
    permissions: (summary.permissions || []).join(", ") || "Read only",
    lastSync: "Current session",
    status: "Connected",
    tone: "binance" as const,
  }] : [];
  const storageSegments = [
    {
      label: "Signal Memory",
      value: signalMemoryCount,
      note: `${signalMemoryCount} snapshots`,
      tone: "accent" as const,
    },
    {
      label: "Bot Configurations",
      value: botReadModel.botCards.length,
      note: `${botReadModel.botCards.length} bots`,
      tone: "profit" as const,
    },
    {
      label: "Backtesting Data",
      value: backtestRuns.length,
      note: `${backtestRuns.length} runs`,
      tone: "warning" as const,
    },
  ];
  const storageUsedGb = (storageUsageBytes / (1024 * 1024 * 1024)).toFixed(2);
  const storageBudgetGb = "10.00";
  const storageProgress = Math.min((storageUsageBytes / (10 * 1024 * 1024 * 1024)) * 100, 100);
  const activeSessions = Math.max(1, users.length);

  useEffect(() => {
    if (!props.initialTab) return;
    setActiveTab(props.initialTab === "binance" ? "security" : props.initialTab);
  }, [props.initialTab]);

  useEffect(() => {
    persistAccountSettings(props.user.username, accountSettings);
    setStorageUsageBytes(computeLocalStorageBytes());
  }, [accountSettings, props.user.username]);

  useEffect(() => {
    persistNotificationSettings(props.user.username, notificationSettings);
    setStorageUsageBytes(computeLocalStorageBytes());
  }, [notificationSettings, props.user.username]);

  useEffect(() => {
    setAccountSettings(loadAccountSettings(props.user.username));
    setNotificationSettings(loadNotificationSettings(props.user.username));
  }, [props.user.username]);

  useEffect(() => {
    setStorageUsageBytes(computeLocalStorageBytes());
  }, []);

  useEffect(() => {
    if (props.user.role !== "admin" || activeTab !== "backtesting") return;
    let cancelled = false;
    setValidationLoading(true);
    setValidationError(null);
    onRefreshValidationLab()
      .then((payload) => {
        if (!cancelled) {
          if (!payload) {
            setValidationError("No se pudo cargar el laboratorio de backtesting");
          }
          setLastBackfillSummary(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setValidationError(error instanceof Error ? error.message : "No se pudo cargar el laboratorio de backtesting");
        }
      })
      .finally(() => {
        if (!cancelled) setValidationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, onRefreshValidationLab, props.user.role]);

  useEffect(() => {
    if (props.user.role !== "admin" || activeTab !== "scanner") return;
    let cancelled = false;
    setScannerLoading(true);
    setScannerError(null);
    onRefreshScannerStatus()
      .then(() => {
        if (!cancelled) {
          setScannerExecution(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setScannerError(error instanceof Error ? error.message : "No se pudo cargar el vigilante");
        }
      })
      .finally(() => {
        if (!cancelled) setScannerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, onRefreshScannerStatus, props.user.role]);

  const scannerSummary = scannerStatus?.summary;
  const latestScannerRun = scannerStatus?.latestRun || null;
  const latestSchedulerRun = scannerStatus?.latestSchedulerRun || null;
  const scannerReadiness = [
    {
      label: "Watchlist activa",
      ok: (scannerSummary?.watchedCoins || 0) > 0,
      note: (scannerSummary?.watchedCoins || 0) > 0 ? `${scannerSummary?.watchedCoins || 0} monedas vigiladas` : "Todavía no hay universo para el vigilante",
    },
    {
      label: "Cron scheduler verificado",
      ok: Boolean(latestSchedulerRun),
      note: latestSchedulerRun ? `Última corrida scheduler: ${new Date(latestSchedulerRun.created_at).toLocaleString("es-DO")}` : "Aún no hay evidencia de corridas scheduler en este entorno",
    },
    {
      label: "Cooldown de Binance libre",
      ok: !scannerSummary?.autoExecutionCooldownActive,
      note: scannerSummary?.autoExecutionCooldownActive ? "El vigilante está esperando para no seguir golpeando Binance" : "Sin cooldown activo ahora mismo",
    },
    {
      label: "Última corrida saludable",
      ok: latestScannerRun?.status === "ok" || Boolean(latestScannerRun && !(latestScannerRun.errors || []).length),
      note: latestScannerRun ? `${latestScannerRun.frames_scanned} marcos · ${latestScannerRun.signals_created} señales` : "Todavía no hay corridas registradas",
    },
  ];

  return (
    <div id="profileView" className="view-panel active">
      <div className="botsettings-tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`botsettings-tab-button ui-chip ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="profile-panel-grid">
        {activeTab === "account" ? (
          <>
            <div className="profile-settings-shell profile-settings-shell--full">
              <SectionCard
                className="profile-settings-card"
              >
                <div className="profile-template-card-header">
                  <div className="profile-settings-head">
                    <div className="profile-settings-icon is-accent">
                      <ProfileSettingsIcon />
                    </div>
                    <div>
                      <h3>Profile Settings</h3>
                      <p>Manage your account information</p>
                    </div>
                  </div>
                  <button type="button" className="profile-inline-action" onClick={() => showToast({ title: "Cuenta actualizada", message: "Tus preferencias locales quedaron guardadas.", tone: "success" })}><EditMiniIcon />Edit</button>
                </div>

                <div className="profile-identity-header">
                  <div className="profile-avatar-badge">{(accountSettings.displayName || props.user.username).slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="profile-identity-name">{accountSettings.displayName}</div>
                    <div className="profile-identity-role">{profileEmail}</div>
                    <div className="profile-profile-pills">
                      <span className="profile-status-chip is-online">{props.user.role === "admin" ? "PRO" : "USER"}</span>
                      <span className={`profile-status-chip ${connection?.connected ? "is-online" : "is-offline"}`}>{connection?.connected ? "Verified" : "Pending"}</span>
                    </div>
                  </div>
                </div>
                <div className="profile-data-list">
                  <div className="profile-data-row"><span>Display Name</span><strong>{accountSettings.displayName}</strong></div>
                  <div className="profile-data-row"><span>Username</span><strong>@{props.user.username}</strong></div>
                  <div className="profile-data-row"><span>Phone</span><strong>{accountSettings.phone}</strong></div>
                  <div className="profile-data-row"><span>Member Since</span><strong>{accountSettings.memberSince}</strong></div>
                </div>
              </SectionCard>

              <SectionCard
                className="profile-settings-card"
              >
                <div className="profile-settings-head">
                  <div className="profile-settings-icon is-info">
                    <LanguageRegionIcon />
                  </div>
                  <div>
                    <h3>Language & Region</h3>
                    <p>Set your preferences</p>
                  </div>
                </div>

                <div className="premium-panel-grid">
                  <div className="premium-field-wide">
                    <label>Language</label>
                    <select value={accountSettings.language} onChange={(event) => setAccountSettings((current) => ({ ...current, language: event.target.value }))}>
                      <option value="English (US)">English (US)</option>
                      <option value="Español (DO)">Español (DO)</option>
                    </select>
                  </div>
                  <div className="premium-field-wide">
                    <label>Timezone</label>
                    <select value={accountSettings.timezone} onChange={(event) => setAccountSettings((current) => ({ ...current, timezone: event.target.value }))}>
                      <option value="America/Santo_Domingo">America/Santo_Domingo</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <div className="premium-field-wide">
                    <label>Currency Display</label>
                    <select value={accountSettings.currencyDisplay} onChange={(event) => setAccountSettings((current) => ({ ...current, currencyDisplay: event.target.value }))}>
                      <option value="USD ($)">USD ($)</option>
                      <option value="DOP (RD$)">DOP (RD$)</option>
                    </select>
                  </div>
                  <div className="premium-field-wide">
                    <label>Date Format</label>
                    <select value={accountSettings.dateFormat} onChange={(event) => setAccountSettings((current) => ({ ...current, dateFormat: event.target.value }))}>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                className="profile-settings-card"
              >
                <div className="profile-settings-head">
                  <div className="profile-settings-icon is-success">
                    <SessionSettingsIcon />
                  </div>
                  <div>
                    <h3>Session Settings</h3>
                    <p>Manage your session preferences</p>
                  </div>
                </div>

                <div className="profile-toggle-list">
                  <div className="profile-toggle-row">
                    <div>
                      <strong>Auto Logout</strong>
                      <span>Automatically log out after inactivity</span>
                    </div>
                    <button type="button" className={`settings-toggle ${accountSettings.autoLogout ? "is-on" : ""}`} aria-pressed={accountSettings.autoLogout} onClick={() => setAccountSettings((current) => ({ ...current, autoLogout: !current.autoLogout }))}>
                      <span />
                    </button>
                  </div>

                  <div className="profile-select-row">
                    <div>
                      <strong>Session Timeout</strong>
                      <span>Time before auto logout</span>
                    </div>
                    <select value={accountSettings.sessionTimeout} onChange={(event) => setAccountSettings((current) => ({ ...current, sessionTimeout: event.target.value }))}>
                      <option value="15 min">15 min</option>
                      <option value="30 min">30 min</option>
                      <option value="60 min">60 min</option>
                    </select>
                  </div>

                  <div className="profile-toggle-row">
                    <div>
                      <strong>Remember Device</strong>
                      <span>Stay logged in on this device</span>
                    </div>
                    <button type="button" className={`settings-toggle ${accountSettings.rememberDevice ? "is-on" : ""}`} aria-pressed={accountSettings.rememberDevice} onClick={() => setAccountSettings((current) => ({ ...current, rememberDevice: !current.rememberDevice }))}>
                      <span />
                    </button>
                  </div>

                  <div className="profile-data-row">
                    <span>Active Sessions</span>
                    <strong>{activeSessions}</strong>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                className="profile-settings-card"
              >
                <div className="profile-settings-head">
                  <div className="profile-settings-icon is-warning">
                    <DataStorageIcon />
                  </div>
                  <div>
                    <h3>Data & Storage</h3>
                    <p>Manage your data preferences</p>
                  </div>
                </div>

                <div className="profile-storage-shell">
                  <div className="profile-storage-topline">
                    <span>Storage Used</span>
                    <strong>{storageUsedGb} GB / {storageBudgetGb} GB</strong>
                  </div>
                  <div className="profile-storage-bar">
                    <span style={{ width: `${storageProgress}%` }} />
                  </div>
                  <div className="profile-storage-list">
                    {storageSegments.map((segment) => (
                      <div key={segment.label} className="profile-storage-row">
                        <span>{segment.label}</span>
                        <strong>{segment.note}</strong>
                      </div>
                    ))}
                    <div className="profile-storage-row">
                      <span>Watchlists</span>
                      <strong>{watchlistsCount}</strong>
                    </div>
                  </div>
                  <div className="premium-action-row">
                    <button
                      type="button"
                      className="premium-action-button is-secondary"
                      onClick={() => {
                        clearProfileStorage(props.user.username);
                        const nextAccountSettings = loadAccountSettings(props.user.username);
                        const nextNotificationSettings = loadNotificationSettings(props.user.username);
                        setAccountSettings(nextAccountSettings);
                        setNotificationSettings(nextNotificationSettings);
                        setStorageUsageBytes(computeLocalStorageBytes());
                        showToast({ title: "Cache local limpiado", message: "Se limpiaron las preferencias locales del modulo de cuenta.", tone: "success" });
                      }}
                    >
                      <TrashMiniIcon />
                      Clear Cache
                    </button>
                  </div>
                </div>
              </SectionCard>
            </div>
          </>
        ) : null}

        {activeTab === "binance" ? (
          <>
            <SectionCard
              title="Binance Connection"
              subtitle="Connect and operate your Binance Demo lane from one place."
              helpTitle="Conexion Binance Demo"
              helpBody="Esta superficie usa la conexion real del sistema. Aqui conectas, refrescas y desconectas la cuenta demo sin tener que salir del area de usuario."
            >
              <div className="profile-settings-shell">
                <article className="profile-settings-card">
                  <div className="profile-settings-head">
                    <div className="profile-settings-icon is-warning">
                      <ExchangeConnectionIcon />
                    </div>
                    <div>
                      <h3>Exchange Connection</h3>
                      <p>{connection?.connected ? "Binance Demo connected and readable." : "Connect your Binance Demo credentials."}</p>
                    </div>
                  </div>

                  <div className="binance-connection-banner">
                    <div>
                      <strong>{connection?.connected ? connection.accountAlias || "Conexion activa" : "Sin conexion activa"}</strong>
                      <p>{connection?.connected ? `${connection.maskedApiKey || "API activa"} · Permisos: ${(summary.permissions || []).join(", ") || "Sin permisos visibles"}` : "Conecta tu API Key y Secret de Binance Demo Spot para activar lectura y ejecucion."}</p>
                    </div>
                    <span className={`profile-status-chip ${connection?.connected ? "is-online" : "is-offline"}`}>
                      {connection?.connected ? "Connected" : "Pending"}
                    </span>
                  </div>

                  <div className="premium-panel-grid">
                    <div className="premium-field-wide">
                      <label>Account Alias</label>
                      <input type="text" value={binanceForm.alias} onChange={(e) => onBinanceFormChange("alias", e.target.value)} placeholder="Ej: Demo principal Jeremias" />
                      <span>Nombre interno para reconocer esta conexion.</span>
                    </div>
                    <div className="premium-field">
                      <label>API Key Demo Spot</label>
                      <input type="text" value={binanceForm.apiKey} onChange={(e) => onBinanceFormChange("apiKey", e.target.value)} placeholder="Pega tu API Key de Binance Demo Spot" />
                      <span>Llave publica usada por la cuenta demo.</span>
                    </div>
                    <div className="premium-field">
                      <label>API Secret Demo Spot</label>
                      <input type="password" value={binanceForm.apiSecret} onChange={(e) => onBinanceFormChange("apiSecret", e.target.value)} placeholder="Pega tu API Secret de Binance Demo Spot" />
                      <span>Secreto privado resuelto en backend.</span>
                    </div>
                  </div>

                  <div className="premium-action-row">
                    <button className="premium-action-button is-primary" onClick={onConnect}>Conectar Binance Demo</button>
                    <button className="premium-action-button is-secondary" type="button" onClick={onRefresh}>Actualizar resumen</button>
                    <button className="premium-action-button is-ghost" type="button" onClick={onDisconnect}>Desconectar</button>
                  </div>
                </article>

                <article className="profile-settings-card">
                  <div className="profile-settings-head">
                    <div className="profile-settings-icon is-success">
                      <BinanceReadIcon />
                    </div>
                    <div>
                      <h3>Connection Readout</h3>
                      <p>Resumen rapido de lo que ya esta leyendo el sistema.</p>
                    </div>
                  </div>

                  <div className="profile-data-list">
                    <div className="profile-data-row"><span>Status</span><strong>{connectionStatus}</strong></div>
                    <div className="profile-data-row"><span>Runtime Lane</span><strong>{runtimeLane}</strong></div>
                    <div className="profile-data-row"><span>UID</span><strong>{summary.uid || "--"}</strong></div>
                    <div className="profile-data-row"><span>Account Type</span><strong>{summary.accountType || "--"}</strong></div>
                    <div className="profile-data-row"><span>Open Orders</span><strong>{summary.openOrdersCount || 0}</strong></div>
                    <div className="profile-data-row"><span>Permissions</span><strong>{(summary.permissions || []).join(", ") || "--"}</strong></div>
                  </div>
                </article>
              </div>
            </SectionCard>
          </>
        ) : null}

        {activeTab === "notifications" ? (
          <>
            <SectionCard
              title="Notifications"
              subtitle="Control your channels and alert priorities from one place."
              helpTitle="Notifications"
              helpBody="Estas preferencias viven a nivel de usuario para no mezclar alertas globales con configuraciones de cada bot."
            >
              <div className="profile-settings-shell">
                <article className="profile-settings-card">
                  <div className="profile-settings-head">
                    <div className="profile-settings-icon is-accent">
                      <NotificationBellIcon />
                    </div>
                    <div>
                      <h3>Notification Channels</h3>
                      <p>Activa o desactiva los canales de entrega.</p>
                    </div>
                  </div>

                  <div className="profile-toggle-list">
                    {[
                      { key: "email", title: "Email", note: profileEmail },
                      { key: "push", title: "Push Notifications", note: "Mobile and desktop alerts" },
                      { key: "telegram", title: "Telegram", note: connection?.connected ? "@crype-binance-demo" : "Connect later" },
                      { key: "discord", title: "Discord", note: "Security and runtime summaries" },
                    ].map((item) => (
                      <div key={item.key} className="profile-toggle-row">
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.note}</span>
                        </div>
                        <button
                          type="button"
                          className={`settings-toggle ${notificationSettings.channels[item.key as keyof NotificationSettings["channels"]] ? "is-on" : ""}`}
                          aria-pressed={notificationSettings.channels[item.key as keyof NotificationSettings["channels"]]}
                          onClick={() =>
                            setNotificationSettings((current) => ({
                              ...current,
                              channels: {
                                ...current.channels,
                                [item.key]: !current.channels[item.key as keyof NotificationSettings["channels"]],
                              },
                            }))
                          }
                        >
                          <span />
                        </button>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="profile-settings-card">
                  <div className="profile-settings-head">
                    <div className="profile-settings-icon is-warning">
                      <NotificationTypeIcon />
                    </div>
                    <div>
                      <h3>Alert Types</h3>
                      <p>Define qué eventos te deben interrumpir.</p>
                    </div>
                  </div>

                  <div className="profile-toggle-list">
                    {[
                      { key: "tradeExecuted", title: "Trade Executed", note: "When a buy or sell order is filled" },
                      { key: "takeProfit", title: "Take Profit Hit", note: "When TP target is reached" },
                      { key: "stopLoss", title: "Stop Loss Triggered", note: "When SL is triggered" },
                      { key: "botStatus", title: "Bot Status Change", note: "Start, stop and pause events" },
                      { key: "dailySummary", title: "Daily Summary", note: "End of day performance report" },
                      { key: "runtimeAlerts", title: "Runtime Alerts", note: "Realtime core and backend incidents" },
                    ].map((item) => (
                      <div key={item.key} className="profile-toggle-row">
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.note}</span>
                        </div>
                        <button
                          type="button"
                          className={`settings-toggle ${notificationSettings.alerts[item.key as keyof NotificationSettings["alerts"]] ? "is-on" : ""}`}
                          aria-pressed={notificationSettings.alerts[item.key as keyof NotificationSettings["alerts"]]}
                          onClick={() =>
                            setNotificationSettings((current) => ({
                              ...current,
                              alerts: {
                                ...current.alerts,
                                [item.key]: !current.alerts[item.key as keyof NotificationSettings["alerts"]],
                              },
                            }))
                          }
                        >
                          <span />
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </SectionCard>
          </>
        ) : null}

        {activeTab === "security" ? (
          <>
            <SectionCard
              title="Security & API Keys"
              subtitle="Esta zona centraliza conexiones de exchange y prácticas de seguridad de cuenta, fuera del flujo operativo de bots."
              helpTitle="Por qué vive aquí"
              helpBody="Las conexiones API pertenecen a la identidad y seguridad del usuario. Los bots las consumen, pero no deben gobernarlas desde Bot Settings."
            >
              <div className="botsettings-general-grid">
                <article className="botsettings-general-card botsettings-api-card botsettings-risk-span">
                  <div className="botsettings-general-head">
                    <div className="botsettings-general-title">
                      <div className="botsettings-general-icon is-info">
                        <ApiConnectionsIcon />
                      </div>
                      <h3>Connected Exchanges</h3>
                    </div>
                    <button type="button" className="ui-button ui-button-primary" onClick={() => setActiveTab("binance")}>
                      <PlusMiniIcon />
                      Add Exchange
                    </button>
                  </div>

                  <div className="botsettings-api-grid">
                    {connectionCards.map((connectionCard) => (
                      <article key={connectionCard.id} className="botsettings-api-exchange-card">
                        <div className="botsettings-api-card-head">
                          <div className="botsettings-api-card-identity">
                            <div className={`botsettings-api-logo is-${connectionCard.tone}`}>
                              <ExchangeBadgeIcon />
                            </div>
                            <div className="botsettings-api-card-copy">
                              <strong>{connectionCard.name}</strong>
                              <span>{connectionCard.accountLabel}</span>
                            </div>
                          </div>
                          <span className="botsettings-status-pill is-running">{connectionCard.status}</span>
                        </div>

                        <div className="botsettings-api-metadata">
                          <div className="botsettings-api-meta-row">
                            <span>API Key</span>
                            <strong>{connectionCard.maskedKey}</strong>
                          </div>
                          <div className="botsettings-api-meta-row">
                            <span>Permissions</span>
                            <strong>{connectionCard.permissions}</strong>
                          </div>
                          <div className="botsettings-api-meta-row">
                            <span>Last Sync</span>
                            <strong>{connectionCard.lastSync}</strong>
                          </div>
                        </div>

                        <div className="botsettings-api-actions">
                          <button type="button" className="botsettings-api-sync-button ui-button" onClick={onRefresh}>
                            <SyncMiniIcon />
                            Sync
                          </button>
                          <button type="button" className="botsettings-api-icon-button" aria-label={`Open ${connectionCard.name} settings`} onClick={() => setActiveTab("binance")}>
                            <GearMiniIcon />
                          </button>
                          <button type="button" className="botsettings-api-icon-button is-danger" aria-label={`Delete ${connectionCard.name}`} onClick={onDisconnect}>
                            <TrashMiniIcon />
                          </button>
                        </div>
                      </article>
                    ))}

                    <button type="button" className="botsettings-api-add-card" onClick={() => setActiveTab("binance")}>
                      <span className="botsettings-api-add-icon">
                        <PlusMiniIcon />
                      </span>
                      <strong>Add Exchange</strong>
                      <span>Connect another exchange</span>
                    </button>
                  </div>
                </article>

                <article className="botsettings-general-card botsettings-api-card botsettings-risk-span">
                  <div className="botsettings-general-head">
                    <div className="botsettings-general-title">
                      <div className="botsettings-general-icon is-success">
                        <SecurityShieldIcon />
                      </div>
                      <h3>API Security Best Practices</h3>
                    </div>
                  </div>

                  <div className="botsettings-api-practices-grid">
                    <SecurityPracticeCard
                      tone="success"
                      icon={<CheckShieldIcon />}
                      title="IP Whitelisting"
                      note="Restrict API access to specific IP addresses"
                    />
                    <SecurityPracticeCard
                      tone="success"
                      icon={<CheckShieldIcon />}
                      title="No Withdrawals"
                      note="API keys should not have withdrawal permissions"
                    />
                    <SecurityPracticeCard
                      tone="warning"
                      icon={<RotationAlertIcon />}
                      title="Key Rotation"
                      note="Rotate your API keys every 90 days"
                    />
                    <SecurityPracticeCard
                      tone="success"
                      icon={<CheckShieldIcon />}
                      title="Encrypted Storage"
                      note="All API keys are encrypted at rest"
                    />
                  </div>
                </article>
              </div>
            </SectionCard>
          </>
        ) : null}

        {props.user.role === "admin" && activeTab === "scanner" ? (
          <>
            <SectionCard
              title="Vigilante 24/7"
              subtitle="Aquí auditamos si el scanner de Señales está listo para trabajar solo en backend, sin depender de la UI."
              helpTitle="Qué mirar aquí"
              helpBody="Esta vista no evalúa la IA del motor, sino la salud operativa del vigilante que debe escanear watchlists, crear señales y cerrar pendientes aunque nadie tenga la app abierta."
            >
      <div className="premium-action-row">
                <button
                  className="premium-action-button is-secondary"
                  type="button"
                  onClick={() => {
                    setScannerLoading(true);
                    setScannerError(null);
                    onRefreshScannerStatus({ forceFresh: true })
                      .then(() => undefined)
                      .catch((error) => setScannerError(error instanceof Error ? error.message : "No se pudo actualizar el vigilante"))
                      .finally(() => setScannerLoading(false));
                  }}
                >
                  {scannerLoading ? "Actualizando..." : "Actualizar vigilante"}
                </button>
                <button
                  className="premium-action-button is-primary"
                  type="button"
                  onClick={() => {
                    setScannerRunning(true);
                    setScannerError(null);
                    onRunScannerNow()
                      .then((payload) => {
                        setScannerExecution(payload);
                      })
                      .catch((error) => setScannerError(error instanceof Error ? error.message : "No se pudo ejecutar el vigilante"))
                      .finally(() => setScannerRunning(false));
                  }}
                >
                  {scannerRunning ? "Corriendo..." : "Correr vigilancia ahora"}
                </button>
              </div>

              {scannerError ? <p className="section-note with-top-gap">{scannerError}</p> : null}

              {scannerStatus ? (
                <>
                  <div className="premium-overview-grid">
                    <StatCard label="Usuarios vigilados" value={String(scannerSummary?.watchedUsers || 0)} detail="Usuarios con watchlist activa" tone="accent" />
                    <StatCard label="Monedas vigiladas" value={String(scannerSummary?.watchedCoins || 0)} detail="Universo actual del scanner" tone="neutral" />
                    <StatCard label="Scheduler runs" value={String(scannerSummary?.schedulerRuns || 0)} detail={latestSchedulerRun ? "Ya hay evidencia automática" : "Aún no se ha visto cron real"} tone={latestSchedulerRun ? "profit" : "warning"} />
                    <StatCard label="Cooldown Binance" value={scannerSummary?.autoExecutionCooldownActive ? "Activo" : "Libre"} detail={scannerSummary?.autoExecutionCooldownUntil ? `Hasta ${new Date(scannerSummary.autoExecutionCooldownUntil).toLocaleString("es-DO")}` : "Sin freno activo"} tone={scannerSummary?.autoExecutionCooldownActive ? "warning" : "profit"} />
                  </div>

                  <div className="profile-validation-grid">
                    <article className="profile-validation-card">
                      <h4>Checklist de readiness 24/7</h4>
                      <div className="profile-validation-list">
                        {scannerReadiness.map((item) => (
                          <div key={item.label} className="profile-validation-row">
                            <span className={`profile-validation-chip is-${item.ok ? "pass" : "warn"}`}>{item.ok ? "OK" : "Pendiente"}</span>
                            <div>
                              <strong>{item.label}</strong>
                              <p>{item.note}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="profile-validation-card">
                      <h4>Estado operativo actual</h4>
                      <div className="profile-validation-list">
                        <div className="profile-validation-row is-block">
                          <div className="profile-validation-row-head">
                            <strong>Última corrida vista</strong>
                            <span>{latestScannerRun ? new Date(latestScannerRun.created_at).toLocaleString("es-DO") : "--"}</span>
                          </div>
                          <p>{latestScannerRun ? `${latestScannerRun.scan_source} · ${latestScannerRun.frames_scanned} marcos · ${latestScannerRun.signals_created} señales` : "Todavía no hay corridas registradas."}</p>
                        </div>
                        <div className="profile-validation-row is-block">
                          <div className="profile-validation-row-head">
                            <strong>Última corrida scheduler</strong>
                            <span>{latestSchedulerRun ? new Date(latestSchedulerRun.created_at).toLocaleString("es-DO") : "--"}</span>
                          </div>
                          <p>{latestSchedulerRun ? `${latestSchedulerRun.frames_scanned} marcos · ${latestSchedulerRun.signals_created} señales creadas` : "Todavía no hay evidencia de cron automático en este entorno."}</p>
                        </div>
                        <div className="profile-validation-row is-block">
                          <div className="profile-validation-row-head">
                            <strong>Razón del cooldown</strong>
                            <span>{scannerSummary?.autoExecutionCooldownActive ? "Activo" : "Libre"}</span>
                          </div>
                          <p>{scannerSummary?.autoExecutionCooldownReason || "Sin motivo registrado: Binance está libre para autoejecución."}</p>
                        </div>
                      </div>
                    </article>
                  </div>

                  {scannerExecution ? (
                    <SectionCard
                      title="Última ejecución manual"
                      subtitle="Resumen de la corrida manual más reciente que disparaste desde este panel."
                      helpTitle="Cómo leer esta corrida"
                      helpBody="Esta corrida sirve para probar el vigilante sin esperar al cron. Si el cooldown entra, aquí mismo podrás verlo reflejado."
                    >
                      <div className="profile-validation-list">
                        {scannerExecution.targets.map((target) => (
                          <div key={`${target.username}-${target.activeListName}`} className="profile-validation-row is-block">
                            <div className="profile-validation-row-head">
                              <strong>{target.username} · {target.activeListName}</strong>
                              <span>{target.scannedFrames} marcos</span>
                            </div>
                            <p>{target.signalsCreated} señales creadas · {target.signalsClosed} cerradas</p>
                            <p>{target.autoOrdersPlaced} autos colocadas · {target.autoOrdersBlocked} bloqueadas · {target.autoOrdersSkipped || 0} saltadas por cooldown</p>
                            <p>{target.autoExecutionCooldownUntil ? `Cooldown hasta ${new Date(target.autoExecutionCooldownUntil).toLocaleString("es-DO")}` : "Sin cooldown posterior a esta corrida"}</p>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  ) : null}

                  <SectionCard
                    title="Historial reciente del vigilante"
                    subtitle="Aquí ves si el scanner está corriendo bien, si se queda en manual o si ya aparecen corridas scheduler."
                    helpTitle="Qué buscar en este historial"
                    helpBody="La meta es que empiecen a aparecer corridas con source scheduler y que los errores de Binance vayan bajando en vez de repetirse cada minuto."
                  >
                    <div className="profile-validation-list">
                      {scannerStatus.runs.length ? scannerStatus.runs.map((run) => (
                        <div key={run.id} className="profile-validation-row is-block">
                          <div className="profile-validation-row-head">
                            <strong>{run.scan_source === "scheduler" ? "Scheduler" : "Manual"} · {new Date(run.created_at).toLocaleString("es-DO")}</strong>
                            <span>{run.status}</span>
                          </div>
                          <p>{run.frames_scanned} marcos · {run.signals_created} señales · {run.signals_closed} cierres</p>
                          <p>{(run.errors || []).length ? `${run.errors?.length || 0} errores registrados` : "Sin errores registrados"}</p>
                        </div>
                      )) : <p className="section-note">Todavía no hay historial del vigilante.</p>}
                    </div>
                  </SectionCard>
                </>
              ) : scannerLoading ? <p className="section-note with-top-gap">Leyendo el estado del vigilante 24/7...</p> : <p className="section-note with-top-gap">Todavía no hay estado cargado del vigilante.</p>}
            </SectionCard>
          </>
        ) : null}

        {props.user.role === "admin" && activeTab === "users" ? (
          <>
            <SectionCard
              title="Usuarios del sistema"
              subtitle="Vision rapida de quienes pueden entrar al producto hoy."
              helpTitle="Usuarios"
              helpBody="Mientras seguimos cerrando el backend, esta lista te deja validar el roster que ya reconoce la aplicacion."
            >
              <div className="profile-user-grid">
                {pagedUsers.rows.map((user) => (
                  <article key={user.username} className="profile-user-card">
                    <div className="profile-user-head">
                      <div className="profile-avatar-mini">{(user.displayName || user.username).slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="profile-user-name">{user.displayName || user.username}</div>
                        <div className="profile-user-role">{user.role === "admin" ? "Administrador" : "Generico"}</div>
                      </div>
                    </div>
                    <div className="profile-user-meta">{user.username}</div>
                  </article>
                ))}
              </div>
              <PaginationControls
                currentPage={pagedUsers.safePage}
                totalPages={pagedUsers.totalPages}
                totalItems={users.length}
                label="usuarios"
                onPageChange={setUsersPage}
              />
            </SectionCard>

            <SectionCard
              title="Estado del backend"
              subtitle="Lectura administrativa del modo en que el sistema esta resolviendo autenticacion hoy."
              helpTitle="Estado del backend"
              helpBody="Esta nota te recuerda si estas leyendo usuarios desde una fuente sembrada o desde el backend persistente que uses en produccion."
            >
              <div className="field-guide-list">
                <div className="field-guide-item">
                  <span className="field-guide-label">Modo actual</span>
                  <span className="field-guide-note">El sistema ya esta preparado para Supabase o backend externo, con fallback controlado si hace falta.</span>
                </div>
              </div>
            </SectionCard>
          </>
        ) : null}

        {props.user.role === "admin" && activeTab === "backtesting" ? (
          <>
            <SectionCard
              title="Laboratorio de backtesting"
              subtitle="Vista técnica para validar si Señales e IA están trabajando como deben, sin depender solo de la UI operativa."
              helpTitle="Qué hace este laboratorio"
              helpBody="Esta vista no ejecuta trades ni genera recomendaciones nuevas. Solo reevalúa historial, compara scorers y revisa invariantes para auditar el motor de Señales."
            >
              <div className="premium-action-row">
                {/* Backtesting commands resolve through the shared system plane so
                    Profile reads the same lab snapshot that other admin surfaces see. */}
                <button
                  className="premium-action-button is-secondary"
                  type="button"
                  onClick={() => {
                    setValidationLoading(true);
                    setValidationError(null);
                    onRefreshValidationLab({ forceFresh: true })
                      .then((payload) => {
                        if (!payload) {
                          setValidationError("No se pudo actualizar el laboratorio");
                        }
                      })
                      .catch((error) => setValidationError(error instanceof Error ? error.message : "No se pudo actualizar el laboratorio"))
                      .finally(() => setValidationLoading(false));
                  }}
                >
                  {validationLoading ? "Actualizando..." : "Actualizar backtesting"}
                </button>
                <button
                  className="premium-action-button is-primary"
                  type="button"
                  onClick={() => {
                    setBacktestRunning(true);
                    setValidationError(null);
                    onEnqueueValidationBacktest({ triggerSource: "admin-ui" })
                      .then((payload) => {
                        if (!payload) {
                          setValidationError("No se pudo encolar la corrida de backtesting");
                        }
                      })
                      .catch((error) => setValidationError(error instanceof Error ? error.message : "No se pudo encolar la corrida de backtesting"))
                      .finally(() => setBacktestRunning(false));
                  }}
                >
                  {backtestRunning ? "Encolando..." : "Encolar backtest"}
                </button>
                <button
                  className="premium-action-button is-secondary"
                  type="button"
                  onClick={() => {
                    setBacktestQueueRunning(true);
                    setValidationError(null);
                    onProcessValidationBacktestQueue({ triggerSource: "admin-ui", limit: 1 })
                      .then((payload) => {
                        if (!payload) {
                          setValidationError("No se pudo procesar la cola de backtesting");
                        }
                      })
                      .catch((error) => setValidationError(error instanceof Error ? error.message : "No se pudo procesar la cola de backtesting"))
                      .finally(() => setBacktestQueueRunning(false));
                  }}
                >
                  {backtestQueueRunning ? "Procesando..." : "Procesar cola"}
                </button>
                <button
                  className="premium-action-button is-ghost"
                  type="button"
                  onClick={() => {
                    setDatasetBackfillRunning(true);
                    setValidationError(null);
                    setLastBackfillSummary(null);
                    onBackfillValidationDataset({ triggerSource: "admin-backfill", limit: 600 })
                      .then((payload) => {
                        if (!payload) {
                          setValidationError("No se pudo ejecutar el backfill del dataset");
                          return;
                        }
                        if (payload.backfill) {
                          setLastBackfillSummary(
                            `${payload.backfill.executionLearningBackfilled} señales recibieron executionLearning y ${payload.backfill.featureSnapshotsBackfilled} snapshots quedaron reconstruidos sobre ${payload.backfill.scannedClosedSignals} cierres revisados.`,
                          );
                        }
                      })
                      .catch((error) => setValidationError(error instanceof Error ? error.message : "No se pudo ejecutar el backfill del dataset"))
                      .finally(() => setDatasetBackfillRunning(false));
                  }}
                >
                  {datasetBackfillRunning ? "Reconstruyendo..." : "Backfill dataset"}
                </button>
              </div>

              {validationError ? <p className="section-note with-top-gap">{validationError}</p> : null}
              {lastBackfillSummary ? <p className="section-note with-top-gap">{lastBackfillSummary}</p> : null}

              {validationReport ? (
                <>
                  <div className="premium-overview-grid">
                    <StatCard label="Madurez IA" value={`${validationReport.summary.maturityScore}/100`} detail="Lectura técnica del módulo Señales" tone={validationReport.summary.maturityScore >= 80 ? "profit" : validationReport.summary.maturityScore >= 60 ? "accent" : "warning"} />
                    <StatCard label="Cierres auditados" value={String(validationReport.summary.closedSignals)} detail="Señales cerradas usadas en replay" tone="neutral" />
                    <StatCard label="Features limpias" value={String(validationReport.summary.featureSnapshots)} detail="Snapshots listos para modelo y replay" tone="accent" />
                    <StatCard label="Invariantes fallidos" value={String(validationReport.summary.failedInvariants)} detail={`${validationReport.summary.passedInvariants} OK · ${validationReport.summary.warnedInvariants} advertencias`} tone={validationReport.summary.failedInvariants ? "warning" : "profit"} />
                    <StatCard label="Cola backtest" value={String(backtestQueue.pending)} detail={`${backtestQueue.running} corriendo ahora mismo`} tone={backtestQueue.pending > 0 ? "warning" : "neutral"} />
                  </div>

                  <div className="profile-validation-grid">
                    <article className="profile-validation-card">
                      <h4>Invariantes del motor</h4>
                      <div className="profile-validation-list">
                        {validationReport.invariants.map((item) => (
                          <div key={item.label} className="profile-validation-row">
                            <span className={`profile-validation-chip is-${item.status}`}>{item.status === "pass" ? "OK" : item.status === "warn" ? "Aviso" : "Fallo"}</span>
                            <div>
                              <strong>{item.label}</strong>
                              <p>{item.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="profile-validation-card">
                      <h4>Replay por ventana</h4>
                      <div className="profile-validation-list">
                        {validationReport.replayWindows.map((item) => (
                          <div key={item.key} className="profile-validation-row is-block">
                            <div className="profile-validation-row-head">
                              <strong>{item.label}</strong>
                              <span>{item.total} cierres</span>
                            </div>
                            <p>{item.activeScorer} {item.activeAvgPnl >= 0 ? "+" : ""}{item.activeAvgPnl} · {item.activeWinRate}%</p>
                            <p>{item.challengerScorer} {item.challengerAvgPnl >= 0 ? "+" : ""}{item.challengerAvgPnl} · {item.challengerWinRate}%</p>
                            <p>{item.verdict}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>

                  <div className="profile-validation-grid">
                    <article className="profile-validation-card">
                      <h4>Scorers comparados</h4>
                      <div className="profile-validation-list">
                        {validationReport.scorerTable.map((item) => (
                          <div key={item.label} className="profile-validation-row is-block">
                            <div className="profile-validation-row-head">
                              <strong>{item.label}</strong>
                              {item.active ? <span className="profile-validation-chip is-pass">Activo</span> : null}
                            </div>
                            <p>{item.total} cierres · win rate {item.winRate}%</p>
                            <p>PnL total {item.pnl >= 0 ? "+" : ""}{item.pnl} · promedio {item.avgPnl >= 0 ? "+" : ""}{item.avgPnl}</p>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="profile-validation-card">
                      <h4>Escenarios simulados</h4>
                      <div className="profile-validation-list">
                        {validationReport.scenarios.map((item) => (
                          <div key={`${item.title}-${item.summary}`} className="profile-validation-row">
                            <span className={`profile-validation-chip is-${item.status === "good" ? "pass" : item.status === "warning" ? "fail" : "warn"}`}>
                              {item.status === "good" ? "Fuerte" : item.status === "warning" ? "Cuidado" : "Observa"}
                            </span>
                            <div>
                              <strong>{item.title}</strong>
                              <p>{item.summary}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>

                  <SectionCard
                    title="Historial de corridas"
                    subtitle="Cada corrida queda guardada para comparar madurez, scorer activo y replay por ventanas a lo largo del tiempo."
                    helpTitle="Qué es una corrida"
                    helpBody="Una corrida es una foto técnica del módulo Señales en un momento específico. Sirve para que tú y yo podamos comparar si la IA se está volviendo más confiable o no."
                  >
                    <div className="profile-validation-list">
                      {backtestRuns.length ? backtestRuns.map((item, index) => (
                        <div key={`${item.createdAt || "run"}-${index}`} className="profile-validation-row is-block">
                          <div className="profile-validation-row-head">
                            <strong>{item.label}</strong>
                            <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("es-DO") : item.triggerSource}</span>
                          </div>
                          <p>{item.summary}</p>
                          <p>{item.activeScorer} · {item.closedSignals} cierres · {item.failedInvariants} fallos · {item.status || "completed"}</p>
                          <div className="profile-validation-mini-grid">
                            {item.windows.map((window) => (
                              <div key={`${item.label}-${window.key}`} className="profile-validation-mini-card">
                                <strong>{window.label}</strong>
                                <p>{window.activeScorer} vs {window.challengerScorer}</p>
                                <p>{window.verdict}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )) : <p className="section-note">Todavía no hay corridas guardadas. Usa “Correr backtest” para empezar a construir historial.</p>}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Historial multi-ventana"
                    subtitle="Rastro técnico de cómo la gobernanza del modelo ha ido votando entre short, recent y global."
                    helpTitle="Cómo leer este historial"
                    helpBody="Aquí no estás viendo operaciones, sino decisiones formales del sistema sobre qué scorer o modelo debería mandar según varias ventanas de tiempo."
                  >
                    <div className="profile-validation-list">
                      {validationReport.modelWindowGovernanceHistory?.length ? validationReport.modelWindowGovernanceHistory.map((item, index) => (
                        <div key={`${item.createdAt || "row"}-${index}`} className="profile-validation-row is-block">
                          <div className="profile-validation-row-head">
                            <strong>{item.activeScorer} → {item.candidateScorer}</strong>
                            <span>{item.action}</span>
                          </div>
                          <p>{item.summary}</p>
                          <p>{item.alignedWindows} ventanas alineadas · confianza {Number(item.confidence || 0).toFixed(2)}</p>
                        </div>
                      )) : <p className="section-note">Todavía no hay suficiente historial multi-ventana para auditar decisiones formales.</p>}
                    </div>
                  </SectionCard>
                </>
              ) : validationLoading ? <p className="section-note with-top-gap">Construyendo replay técnico y validación del motor...</p> : <p className="section-note with-top-gap">Todavía no hay reporte técnico cargado.</p>}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}

interface AccountSettings {
  displayName: string;
  phone: string;
  memberSince: string;
  language: string;
  timezone: string;
  currencyDisplay: string;
  dateFormat: string;
  autoLogout: boolean;
  sessionTimeout: string;
  rememberDevice: boolean;
}

interface NotificationSettings {
  channels: {
    email: boolean;
    push: boolean;
    telegram: boolean;
    discord: boolean;
  };
  alerts: {
    tradeExecuted: boolean;
    takeProfit: boolean;
    stopLoss: boolean;
    botStatus: boolean;
    dailySummary: boolean;
    runtimeAlerts: boolean;
  };
}

const PROFILE_ACCOUNT_SETTINGS_KEY_PREFIX = "crype-profile-account-settings";
const PROFILE_NOTIFICATION_SETTINGS_KEY_PREFIX = "crype-profile-notification-settings";

function buildProfileAccountSettingsKey(username: string | null | undefined) {
  const normalized = String(username || "").trim().toLowerCase();
  return normalized ? `${PROFILE_ACCOUNT_SETTINGS_KEY_PREFIX}:${normalized}` : PROFILE_ACCOUNT_SETTINGS_KEY_PREFIX;
}

function buildProfileNotificationSettingsKey(username: string | null | undefined) {
  const normalized = String(username || "").trim().toLowerCase();
  return normalized ? `${PROFILE_NOTIFICATION_SETTINGS_KEY_PREFIX}:${normalized}` : PROFILE_NOTIFICATION_SETTINGS_KEY_PREFIX;
}

function loadAccountSettings(username?: string | null): AccountSettings {
  if (typeof window === "undefined") {
    return defaultAccountSettings();
  }

  try {
    const raw = window.localStorage.getItem(buildProfileAccountSettingsKey(username));
    if (!raw) return defaultAccountSettings();
    return { ...defaultAccountSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultAccountSettings();
  }
}

function loadNotificationSettings(username?: string | null): NotificationSettings {
  if (typeof window === "undefined") {
    return defaultNotificationSettings();
  }

  try {
    const raw = window.localStorage.getItem(buildProfileNotificationSettingsKey(username));
    if (!raw) return defaultNotificationSettings();
    const parsed = JSON.parse(raw);
    return {
      channels: { ...defaultNotificationSettings().channels, ...(parsed?.channels || {}) },
      alerts: { ...defaultNotificationSettings().alerts, ...(parsed?.alerts || {}) },
    };
  } catch {
    return defaultNotificationSettings();
  }
}

function persistAccountSettings(username: string | null | undefined, settings: AccountSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildProfileAccountSettingsKey(username), JSON.stringify(settings));
}

function persistNotificationSettings(username: string | null | undefined, settings: NotificationSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildProfileNotificationSettingsKey(username), JSON.stringify(settings));
}

function computeLocalStorageBytes() {
  if (typeof window === "undefined") return 0;
  try {
    return Object.entries(window.localStorage).reduce((total, [key, value]) => total + key.length + value.length, 0);
  } catch {
    return 0;
  }
}

function clearProfileStorage(username: string | null | undefined) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(buildProfileAccountSettingsKey(username));
  window.localStorage.removeItem(buildProfileNotificationSettingsKey(username));
}

function defaultAccountSettings(): AccountSettings {
  return {
    displayName: "Jeremias",
    phone: "+1 (829) 000-0000",
    memberSince: "Jan 15, 2024",
    language: "English (US)",
    timezone: "America/Santo_Domingo",
    currencyDisplay: "USD ($)",
    dateFormat: "MM/DD/YYYY",
    autoLogout: true,
    sessionTimeout: "30 min",
    rememberDevice: true,
  };
}

function defaultNotificationSettings(): NotificationSettings {
  return {
    channels: {
      email: true,
      push: true,
      telegram: false,
      discord: false,
    },
    alerts: {
      tradeExecuted: true,
      takeProfit: true,
      stopLoss: true,
      botStatus: true,
      dailySummary: false,
      runtimeAlerts: true,
    },
  };
}

function SecurityPracticeCard(props: { tone: "success" | "warning"; icon: ReactNode; title: string; note: string }) {
  return (
    <article className="botsettings-security-card">
      <div className={`botsettings-security-icon is-${props.tone}`}>{props.icon}</div>
      <div className="botsettings-security-copy">
        <strong>{props.title}</strong>
        <span>{props.note}</span>
      </div>
    </article>
  );
}

function ProfileSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 18.5c1.4-2.6 3.4-3.9 5.5-3.9s4.1 1.3 5.5 3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LanguageRegionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 12h14M12 5c1.8 2 2.7 4.3 2.7 7s-.9 5-2.7 7c-1.8-2-2.7-4.3-2.7-7s.9-5 2.7-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SessionSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.5V12l2.5 1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DataStorageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="6.5" rx="5.5" ry="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 6.5V12c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V6.5M6.5 12v5.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V12" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ExchangeConnectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 7h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 12h5M13 9.5 15.5 12 13 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BinanceReadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 6.5h8M8 12h8M8 17.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 17.5 19.5 20l2.5-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NotificationBellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5a4 4 0 0 0-4 4v2.6L6.8 14c-.5 1 .2 2.2 1.3 2.2h7.8c1.1 0 1.8-1.2 1.3-2.2L16 11.6V9a4 4 0 0 0-4-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10.2 18a2 2 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NotificationTypeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4 18.5 7.5V12c0 4-2.3 6.4-6.5 8-4.2-1.6-6.5-4-6.5-8V7.5L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" />
    </svg>
  );
}

function ProfileTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 18.5c1.4-2.6 3.4-3.9 5.5-3.9s4.1 1.3 5.5 3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIconMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5a4 4 0 0 0-4 4v2.6L6.8 14c-.5 1 .2 2.2 1.3 2.2h7.8c1.1 0 1.8-1.2 1.3-2.2L16 11.6V9a4 4 0 0 0-4-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10.2 18a2 2 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ScannerTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12c2.1-3.33 4.77-5 8-5s5.9 1.67 8 5c-2.1 3.33-4.77 5-8 5s-5.9-1.67-8-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function BacktestingTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 18V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 18V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 18v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UsersTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M17 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 18a4.5 4.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.5 17.5a3.5 3.5 0 0 1 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EditMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 19.5h3l9.1-9.1-3-3L4.5 16.5v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m12.9 5.1 3 3 1.5-1.5a1.1 1.1 0 0 0 0-1.6L15.9 3.6a1.1 1.1 0 0 0-1.6 0L12.9 5.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ApiConnectionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.5 8.5a2.5 2.5 0 0 1 3.5 0l1.1 1.1a2.5 2.5 0 0 1 0 3.5l-1.1 1.1a2.5 2.5 0 0 1-3.5 0a2.5 2.5 0 0 1 0-3.5l.7-.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 9.8a2.5 2.5 0 0 1 0 3.5l-1.1 1.1a2.5 2.5 0 0 1-3.5 0l-1.1-1.1a2.5 2.5 0 0 1 0-3.5a2.5 2.5 0 0 1 3.5 0l.7.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SecurityShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4.5 18 7v4.5c0 4.2-2.4 6.8-6 8-3.6-1.2-6-3.8-6-8V7l6-2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ExchangeBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 5h8v3H8zM7 9h10v10H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 12h4M10 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SyncMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12a7 7 0 0 1 12-4.8L19 9M19 9V5m0 4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 12a7 7 0 0 1-12 4.8L5 15m0 0v4m0-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 9.4a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 0 0 0-5.2Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m19 12-.9-.4a6.8 6.8 0 0 0-.5-1.2l.4-.9-1.4-1.4-.9.4c-.4-.2-.8-.4-1.2-.5L14 5h-2l-.4.9c-.4.1-.8.3-1.2.5l-.9-.4-1.4 1.4.4.9c-.2.4-.4.8-.5 1.2L5 12v2l.9.4c.1.4.3.8.5 1.2l-.4.9 1.4 1.4.9-.4c.4.2.8.4 1.2.5L12 19h2l.4-.9c.4-.1.8-.3 1.2-.5l.9.4 1.4-1.4-.4-.9c.2-.4.4-.8.5-1.2l.9-.4v-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function TrashMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 7.5h11M9.5 7.5V6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M8.5 9.5v7m3-7v7m3-7v7M7.5 19h9a1 1 0 0 0 1-1l.6-9.5H6.9L7.5 18a1 1 0 0 0 1 1Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4.5 18 7v4.5c0 4.2-2.4 6.8-6 8-3.6-1.2-6-3.8-6-8V7l6-2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9.4 12.4 1.7 1.7 3.5-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RotationAlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5a7 7 0 0 1 6.4 4.2M19 5v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 19a7 7 0 0 1-6.4-4.2M5 19v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}
