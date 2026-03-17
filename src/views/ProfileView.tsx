import { useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import type { BinanceConnection, UserSession } from "../types";

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
  const [activeTab, setActiveTab] = useState<"account" | "binance" | "users">("account");
  const connection = props.connection;
  const summary = connection?.summary || {};
  const tabs = [
    { key: "account", label: "Cuenta" },
    { key: "binance", label: "Binance" },
    ...(props.user.role === "admin" ? [{ key: "users", label: "Usuarios" }] : []),
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
        <StatCard label="Usuarios visibles" value={String(props.users.length)} detail={props.user.role === "admin" ? "Panel administrativo" : "Solo lectura"} tone="accent" />
      </div>

      <ModuleTabs items={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as "account" | "binance" | "users")} />

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
                {props.users.map((user) => (
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
      </div>
    </div>
  );
}
