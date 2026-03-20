import { useEffect, useState, type ReactNode } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { PaginationControls, paginateRows } from "../components/ui/PaginationControls";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useProfileSystemSelector } from "../data-platform/selectors";
import type { UserSession, WatchlistScanExecution } from "../types";

interface ProfileViewProps {
  user: UserSession;
  initialTab?: "account" | "binance" | "security" | "users" | "backtesting" | "scanner";
}

export function ProfileView(props: ProfileViewProps) {
  const systemData = useProfileSystemSelector();
  const [activeTab, setActiveTab] = useState<"account" | "binance" | "security" | "users" | "backtesting" | "scanner">(props.initialTab || "account");
  const [usersPage, setUsersPage] = useState(1);
  const [scannerExecution, setScannerExecution] = useState<WatchlistScanExecution | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [datasetBackfillRunning, setDatasetBackfillRunning] = useState(false);
  const [backtestQueueRunning, setBacktestQueueRunning] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [realtimeChecking, setRealtimeChecking] = useState(false);
  const [lastBackfillSummary, setLastBackfillSummary] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  // Profile keeps the authenticated user as an explicit prop, but all mutable
  // operational/admin state now comes from the shared system plane.
  const connection = systemData.connection || null;
  const binanceForm = systemData.binanceForm || { alias: "", apiKey: "", apiSecret: "" };
  const onBinanceFormChange = systemData.setBinanceFormField || (() => undefined);
  const onConnect = systemData.connectBinance || (() => undefined);
  const onRefresh = systemData.refreshProfileDataWithFeedback || (() => undefined);
  const onDisconnect = systemData.disconnectBinance || (() => undefined);
  const onRefreshRealtimeRuntime = systemData.refreshRealtimeCoreStatus || (async () => null);
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
  const summary = connection?.summary || {};
  const users = systemData.availableUsers || [];
  const pagedUsers = paginateRows(users, usersPage);
  const realtimeCore = systemData.realtimeCore;
  const realtimeReadiness = [
    {
      label: "URL externa configurada",
      ok: realtimeCore.configured,
      note: realtimeCore.configured ? realtimeCore.targetLabel : "Todavía no hay un host realtime externo configurado",
    },
    {
      label: "Servicio saludable",
      ok: realtimeCore.healthy,
      note: realtimeCore.healthy ? "El runtime respondió saludable en la última verificación" : "La app degradó al fallback porque el core externo no respondió bien",
    },
    {
      label: "Modo activo externo",
      ok: realtimeCore.activeMode === "external",
      note: realtimeCore.activeMode === "external" ? "Producción ya está entrando por el core persistente" : "La app sigue usando el fallback interno de Vercel",
    },
  ];
  const tabs = [
    { key: "account", label: "Cuenta" },
    { key: "binance", label: "Binance" },
    { key: "security", label: "Security & API Keys" },
    ...(props.user.role === "admin" ? [{ key: "scanner", label: "Vigilante" }] : []),
    ...(props.user.role === "admin" ? [{ key: "backtesting", label: "Backtesting" }] : []),
    ...(props.user.role === "admin" ? [{ key: "users", label: "Usuarios" }] : []),
  ];

  useEffect(() => {
    if (!props.initialTab) return;
    setActiveTab(props.initialTab);
  }, [props.initialTab]);

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
      <SectionCard
        title="Perfil y conexiones"
        subtitle="Desde aqui controlas tu identidad, el acceso a Binance Demo y la visibilidad del backend."
        helpTitle="Como leer esta vista"
        helpBody="Perfil no es solo informacion basica. Tambien es la zona donde confirmas si tu cuenta esta lista para operar y si Binance Demo esta enlazado correctamente."
      />

      <div className="premium-overview-grid">
        <StatCard label="Usuario activo" value={props.user.displayName || props.user.username} detail={props.user.role === "admin" ? "Administrador" : "Usuario"} tone="accent" />
        <StatCard label="Conexion Binance" value={connection?.connected ? "Activa" : "Sin conectar"} detail={connection?.maskedApiKey || "Todavia no enlazada"} tone={connection?.connected ? "profit" : "warning"} />
        <StatCard label="Ordenes abiertas" value={String(summary.openOrdersCount || 0)} detail={connection?.connected ? "Leidas desde Binance Demo" : "Sin lectura activa"} tone="neutral" />
        <StatCard label="Usuarios visibles" value={String(users.length)} detail={props.user.role === "admin" ? "Panel administrativo" : "Solo lectura"} tone="accent" />
      </div>

      <ModuleTabs items={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as "account" | "binance" | "security" | "users" | "backtesting" | "scanner")} />

      <div className="profile-panel-grid">
        {activeTab === "account" ? (
          <>
            <SectionCard
              title="Identidad de la cuenta"
              subtitle="Resumen rapido de quien eres dentro de la app."
              helpTitle="Identidad"
              helpBody="Este bloque te deja confirmar rapidamente con que usuario y nivel de acceso estas trabajando."
            >
              <div className="profile-identity-card">
                <div className="profile-identity-header">
                  <div className="profile-avatar-badge">{(props.user.displayName || props.user.username).slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="profile-identity-name">{props.user.displayName || props.user.username}</div>
                    <div className="profile-identity-role">{props.user.username} · {props.user.role === "admin" ? "Administrador" : "Usuario"}</div>
                  </div>
                </div>
                <div className="profile-data-list">
                  <div className="profile-data-row"><span>Nombre visible</span><strong>{props.user.displayName || props.user.username}</strong></div>
                  <div className="profile-data-row"><span>Usuario</span><strong>{props.user.username}</strong></div>
                  <div className="profile-data-row"><span>Rol</span><strong>{props.user.role === "admin" ? "Administrador" : "Generico"}</strong></div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Seguridad y edicion"
              subtitle="Por ahora la cuenta esta en modo controlado mientras terminamos las siguientes fases del backend."
              helpTitle="Seguridad"
              helpBody="Todavia no estamos editando datos sensibles desde aqui. Esta zona sirve para recordarte el estado actual del backend y lo que viene despues."
            >
              <div className="field-guide-list">
                <div className="field-guide-item">
                  <span className="field-guide-label">Cambio de contrasena</span>
                  <span className="field-guide-note">Se habilitara cuando cerremos persistencia y recuperacion segura.</span>
                </div>
                <div className="field-guide-item">
                  <span className="field-guide-label">Sesion actual</span>
                  <span className="field-guide-note">Tu acceso ya esta persistido, pero la edicion profunda sigue protegida.</span>
                </div>
              </div>
            </SectionCard>

            {props.user.role === "admin" ? (
              <SectionCard
                title="Runtime realtime"
                subtitle="Lectura operativa del camino realtime que está usando CRYPE ahora mismo."
                helpTitle="Realtime runtime"
                helpBody="Este bloque confirma si la app está entrando por el realtime core externo o por el fallback interno de Vercel. Sirve para validar el cutover sin abrir la red del navegador."
              >
                <div className="profile-data-list">
                  <div className="profile-data-row">
                    <span>Destino configurado</span>
                    <strong>{realtimeCore.targetLabel}</strong>
                  </div>
                  <div className="profile-data-row">
                    <span>Modo preferido</span>
                    <strong>{realtimeCore.preferredMode === "external" ? "Realtime core externo" : "Fallback interno"}</strong>
                  </div>
                  <div className="profile-data-row">
                    <span>Modo activo</span>
                    <strong>{realtimeCore.activeMode === "external" ? "External core" : "Serverless fallback"}</strong>
                  </div>
                  <div className="profile-data-row">
                    <span>Servicio saludable</span>
                    <strong>{realtimeCore.healthy ? "Sí" : "No"}</strong>
                  </div>
                  <div className="profile-data-row">
                    <span>Core configurado</span>
                    <strong>{realtimeCore.configured ? "Sí" : "No"}</strong>
                  </div>
                  <div className="profile-data-row">
                    <span>Última verificación</span>
                    <strong>{realtimeCore.lastCheckedAt ? new Date(realtimeCore.lastCheckedAt).toLocaleString("es-DO") : "--"}</strong>
                  </div>
                  <div className="profile-data-row">
                    <span>Modo del servicio</span>
                    <strong>{realtimeCore.serviceMode || "--"}</strong>
                  </div>
                  <div className="profile-data-row">
                    <span>Canales activos</span>
                    <strong>{realtimeCore.activeChannels ?? "--"}</strong>
                  </div>
                  <div className="profile-data-row">
                    <span>Subscribers activos</span>
                    <strong>{realtimeCore.activeSubscribers ?? "--"}</strong>
                  </div>
                  <div className="profile-data-row">
                    <span>Polling del core</span>
                    <strong>{realtimeCore.pollIntervalMs ? `${realtimeCore.pollIntervalMs} ms` : "--"}</strong>
                  </div>
                </div>

                <div className="profile-runtime-checklist">
                  {realtimeReadiness.map((item) => (
                    <div key={item.label} className="profile-runtime-check">
                      <span className={`profile-validation-chip ${item.ok ? "is-pass" : "is-warn"}`}>{item.ok ? "OK" : "Pendiente"}</span>
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {realtimeError ? (
                  <div className="profile-runtime-error">{realtimeError}</div>
                ) : null}

                <div className="premium-action-row">
                  <button
                    className="premium-action-button is-secondary"
                    type="button"
                    onClick={() => {
                      setRealtimeChecking(true);
                      setRealtimeError(null);
                      void onRefreshRealtimeRuntime()
                        .catch((error) => {
                          setRealtimeError(error instanceof Error ? error.message : "No se pudo revalidar el runtime realtime");
                        })
                        .finally(() => {
                          setRealtimeChecking(false);
                        });
                    }}
                    disabled={realtimeChecking}
                  >
                    {realtimeChecking ? "Verificando..." : "Revalidar runtime"}
                  </button>
                </div>
              </SectionCard>
            ) : null}
          </>
        ) : null}

        {activeTab === "binance" ? (
          <>
            <SectionCard
              title="Conectar Binance Demo"
              subtitle="Esta es la pieza que habilita lectura de cuenta y ejecucion de prueba dentro del sistema."
              helpTitle="Conexion Binance Demo"
              helpBody="Aqui conectas la API de prueba para que el sistema pueda leer balance, ordenes y ejecutar en modo demo."
            >
              <div className="binance-connection-banner">
                <div>
                  <strong>{connection?.connected ? connection.accountAlias || "Conexion activa" : "Sin conexion activa"}</strong>
                  <p>{connection?.connected ? `${connection.maskedApiKey || "API activa"} · Permisos: ${(summary.permissions || []).join(", ") || "Sin permisos visibles"}` : "Conecta tu API Key y Secret de Binance Demo Spot para activar lectura y ejecucion."}</p>
                </div>
                <span className={`profile-status-chip ${connection?.connected ? "is-online" : "is-offline"}`}>
                  {connection?.connected ? "Conectado" : "Pendiente"}
                </span>
              </div>

              <div className="premium-panel-grid">
                <div className="premium-field premium-field-wide">
                  <label>Alias de la cuenta</label>
                  <input type="text" value={binanceForm.alias} onChange={(e) => onBinanceFormChange("alias", e.target.value)} placeholder="Ej: Demo principal Jeremias" />
                  <span>Nombre interno para reconocer esta conexion.</span>
                </div>
                <div className="premium-field">
                  <label>API Key Demo Spot</label>
                  <input type="text" value={binanceForm.apiKey} onChange={(e) => onBinanceFormChange("apiKey", e.target.value)} placeholder="Pega tu API Key de Binance Demo Spot" />
                  <span>Llave publica que Binance Demo te entrega para acceso.</span>
                </div>
                <div className="premium-field">
                  <label>API Secret Demo Spot</label>
                  <input type="password" value={binanceForm.apiSecret} onChange={(e) => onBinanceFormChange("apiSecret", e.target.value)} placeholder="Pega tu API Secret de Binance Demo Spot" />
                  <span>Secreto privado cifrado en backend.</span>
                </div>
              </div>

              <div className="premium-action-row">
                <button className="premium-action-button is-primary" onClick={onConnect}>Conectar Binance Demo</button>
                <button className="premium-action-button is-secondary" type="button" onClick={onRefresh}>Actualizar resumen</button>
                <button className="premium-action-button is-ghost" type="button" onClick={onDisconnect}>Desconectar</button>
              </div>
            </SectionCard>

            <SectionCard
              title="Lectura de la conexion"
              subtitle="Resumen rapido de lo que ya esta leyendo el sistema desde Binance Demo."
              helpTitle="Lectura actual"
              helpBody="Este bloque te confirma si la conexion no solo existe, sino si ademas esta entregando informacion util al sistema."
            >
              <div className="profile-data-list">
                <div className="profile-data-row"><span>UID</span><strong>{summary.uid || "--"}</strong></div>
                <div className="profile-data-row"><span>Tipo de cuenta</span><strong>{summary.accountType || "--"}</strong></div>
                <div className="profile-data-row"><span>Ordenes abiertas</span><strong>{summary.openOrdersCount || 0}</strong></div>
                <div className="profile-data-row"><span>Permisos</span><strong>{(summary.permissions || []).join(", ") || "--"}</strong></div>
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
                    <button type="button" className="ui-button ui-button-primary">
                      <PlusMiniIcon />
                      Add Exchange
                    </button>
                  </div>

                  <div className="botsettings-api-grid">
                    {PROFILE_API_CONNECTIONS.map((connection) => (
                      <article key={connection.id} className="botsettings-api-exchange-card">
                        <div className="botsettings-api-card-head">
                          <div className="botsettings-api-card-identity">
                            <div className={`botsettings-api-logo is-${connection.tone}`}>
                              <ExchangeBadgeIcon />
                            </div>
                            <div className="botsettings-api-card-copy">
                              <strong>{connection.name}</strong>
                              <span>{connection.accountLabel}</span>
                            </div>
                          </div>
                          <span className="botsettings-status-pill is-running">{connection.status}</span>
                        </div>

                        <div className="botsettings-api-metadata">
                          <div className="botsettings-api-meta-row">
                            <span>API Key</span>
                            <strong>{connection.maskedKey}</strong>
                          </div>
                          <div className="botsettings-api-meta-row">
                            <span>Permissions</span>
                            <strong>{connection.permissions}</strong>
                          </div>
                          <div className="botsettings-api-meta-row">
                            <span>Last Sync</span>
                            <strong>{connection.lastSync}</strong>
                          </div>
                        </div>

                        <div className="botsettings-api-actions">
                          <button type="button" className="botsettings-api-sync-button ui-button">
                            <SyncMiniIcon />
                            Sync
                          </button>
                          <button type="button" className="botsettings-api-icon-button" aria-label={`Open ${connection.name} settings`}>
                            <GearMiniIcon />
                          </button>
                          <button type="button" className="botsettings-api-icon-button is-danger" aria-label={`Delete ${connection.name}`}>
                            <TrashMiniIcon />
                          </button>
                        </div>
                      </article>
                    ))}

                    <button type="button" className="botsettings-api-add-card">
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

const PROFILE_API_CONNECTIONS = [
  {
    id: "binance-main",
    name: "Binance",
    accountLabel: "Main Account",
    maskedKey: "••••x7Kf3",
    permissions: "Read, Trade",
    lastSync: "2 min ago",
    status: "Connected",
    tone: "binance" as const,
  },
  {
    id: "coinbase-pro",
    name: "Coinbase Pro",
    accountLabel: "Trading Account",
    maskedKey: "••••m2Zb8",
    permissions: "Read, Trade",
    lastSync: "5 min ago",
    status: "Connected",
    tone: "coinbase" as const,
  },
];

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
