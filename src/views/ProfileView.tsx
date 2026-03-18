import { useEffect, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { PaginationControls, paginateRows } from "../components/ui/PaginationControls";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { strategyEngineService } from "../services/api";
import type { BinanceConnection, StrategyBacktestRun, StrategyValidationReport, UserSession } from "../types";

interface ProfileViewProps {
  user: UserSession;
  users: UserSession[];
  connection: BinanceConnection | null;
  binanceForm: { alias: string; apiKey: string; apiSecret: string };
  onBinanceFormChange: (field: "alias" | "apiKey" | "apiSecret", value: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
  onDisconnect: () => void;
}

export function ProfileView(props: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState<"account" | "binance" | "users" | "backtesting">("account");
  const [usersPage, setUsersPage] = useState(1);
  const [validationReport, setValidationReport] = useState<StrategyValidationReport | null>(null);
  const [backtestRuns, setBacktestRuns] = useState<StrategyBacktestRun[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const connection = props.connection;
  const summary = connection?.summary || {};
  const pagedUsers = paginateRows(props.users, usersPage);
  const tabs = [
    { key: "account", label: "Cuenta" },
    { key: "binance", label: "Binance" },
    ...(props.user.role === "admin" ? [{ key: "backtesting", label: "Backtesting" }] : []),
    ...(props.user.role === "admin" ? [{ key: "users", label: "Usuarios" }] : []),
  ];

  useEffect(() => {
    if (props.user.role !== "admin" || activeTab !== "backtesting") return;
    let cancelled = false;
    setValidationLoading(true);
    setValidationError(null);
    strategyEngineService
      .getValidationLab()
      .then((payload) => {
        if (!cancelled) {
          setValidationReport(payload.report);
          setBacktestRuns(Array.isArray(payload.runs) ? payload.runs : []);
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
  }, [activeTab, props.user.role]);

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
        <StatCard label="Usuarios visibles" value={String(props.users.length)} detail={props.user.role === "admin" ? "Panel administrativo" : "Solo lectura"} tone="accent" />
      </div>

      <ModuleTabs items={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as "account" | "binance" | "users" | "backtesting")} />

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
                  <input type="text" value={props.binanceForm.alias} onChange={(e) => props.onBinanceFormChange("alias", e.target.value)} placeholder="Ej: Demo principal Jeremias" />
                  <span>Nombre interno para reconocer esta conexion.</span>
                </div>
                <div className="premium-field">
                  <label>API Key Demo Spot</label>
                  <input type="text" value={props.binanceForm.apiKey} onChange={(e) => props.onBinanceFormChange("apiKey", e.target.value)} placeholder="Pega tu API Key de Binance Demo Spot" />
                  <span>Llave publica que Binance Demo te entrega para acceso.</span>
                </div>
                <div className="premium-field">
                  <label>API Secret Demo Spot</label>
                  <input type="password" value={props.binanceForm.apiSecret} onChange={(e) => props.onBinanceFormChange("apiSecret", e.target.value)} placeholder="Pega tu API Secret de Binance Demo Spot" />
                  <span>Secreto privado cifrado en backend.</span>
                </div>
              </div>

              <div className="premium-action-row">
                <button className="premium-action-button is-primary" onClick={props.onConnect}>Conectar Binance Demo</button>
                <button className="premium-action-button is-secondary" type="button" onClick={props.onRefresh}>Actualizar resumen</button>
                <button className="premium-action-button is-ghost" type="button" onClick={props.onDisconnect}>Desconectar</button>
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
                totalItems={props.users.length}
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
                <button
                  className="premium-action-button is-secondary"
                  type="button"
                  onClick={() => {
                    setValidationLoading(true);
                    setValidationError(null);
                    strategyEngineService
                      .getValidationLab()
                      .then((payload) => {
                        setValidationReport(payload.report);
                        setBacktestRuns(Array.isArray(payload.runs) ? payload.runs : []);
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
                    strategyEngineService
                      .runValidationBacktest({ triggerSource: "admin-ui" })
                      .then((payload) => {
                        setValidationReport(payload.report);
                        setBacktestRuns(Array.isArray(payload.runs) ? payload.runs : []);
                      })
                      .catch((error) => setValidationError(error instanceof Error ? error.message : "No se pudo ejecutar la corrida de backtesting"))
                      .finally(() => setBacktestRunning(false));
                  }}
                >
                  {backtestRunning ? "Corriendo..." : "Correr backtest"}
                </button>
              </div>

              {validationError ? <p className="section-note with-top-gap">{validationError}</p> : null}

              {validationReport ? (
                <>
                  <div className="premium-overview-grid">
                    <StatCard label="Madurez IA" value={`${validationReport.summary.maturityScore}/100`} detail="Lectura técnica del módulo Señales" tone={validationReport.summary.maturityScore >= 80 ? "profit" : validationReport.summary.maturityScore >= 60 ? "accent" : "warning"} />
                    <StatCard label="Cierres auditados" value={String(validationReport.summary.closedSignals)} detail="Señales cerradas usadas en replay" tone="neutral" />
                    <StatCard label="Features limpias" value={String(validationReport.summary.featureSnapshots)} detail="Snapshots listos para modelo y replay" tone="accent" />
                    <StatCard label="Invariantes fallidos" value={String(validationReport.summary.failedInvariants)} detail={`${validationReport.summary.passedInvariants} OK · ${validationReport.summary.warnedInvariants} advertencias`} tone={validationReport.summary.failedInvariants ? "warning" : "profit"} />
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
                          <p>{item.activeScorer} · {item.closedSignals} cierres · {item.failedInvariants} fallos</p>
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
