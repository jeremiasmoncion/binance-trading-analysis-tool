import { SectionCard } from "../components/ui/SectionCard";
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
  const connection = props.connection;
  const summary = connection?.summary || {};
  const identityParts = [connection?.accountAlias || null, summary.uid ? `UID ${summary.uid}` : null, summary.accountType || null].filter(Boolean);

  return (
    <div id="profileView" className="view-panel active">
      <SectionCard title="Perfil y acceso" subtitle="Gestiona tu perfil, tu contraseña y, si eres admin, la administración de usuarios." />

      <div className="profile-grid">
        <div className="profile-section">
          <h3>Mi perfil</h3>
          <div className="calc-input-group"><label>Usuario</label><input type="text" value={props.user.username} readOnly /></div>
          <div className="calc-input-group"><label>Rol</label><input type="text" value={props.user.role === "admin" ? "Administrador" : "Genérico"} readOnly /></div>
          <div className="calc-input-group"><label>Nombre visible</label><input type="text" value={props.user.displayName || props.user.username} readOnly /></div>
          <div className="calc-input-group"><label>Nueva contraseña</label><input type="password" placeholder="Disponible en la siguiente fase" disabled /></div>
          <p className="section-note with-top-gap">Fase 1 del backend: login y sesiones reales. La edición de perfil y contraseñas llegará cuando agreguemos persistencia.</p>
          <button className="btn-primary section-fill-button with-top-gap" disabled>Disponible próximamente</button>
        </div>

        <div className="profile-section">
          <h3>Binance Demo Spot</h3>
          <p className="section-note with-bottom-gap">Conecta tu cuenta de prueba de Binance Demo Spot en modo solo lectura. Tus claves se guardan cifradas en el backend.</p>
          <div className="binance-status-card">
            <div className="binance-status-title">
              {connection?.connected ? identityParts.join(" · ") || `Conectado: ${connection.maskedApiKey || "API activa"}` : "Sin conexión"}
            </div>
            <div className="binance-status-note">
              {connection?.connected
                ? `API ${connection.maskedApiKey || "activa"} · Permisos: ${(summary.permissions || []).join(", ") || "Sin permisos"} · Órdenes abiertas: ${summary.openOrdersCount || 0} · Estado: conectado correctamente.`
                : "Conecta tu API Key y Secret de Binance Demo Spot para habilitar lectura de cuenta."}
            </div>
          </div>
          <div className="calc-input-group"><label>Alias de la cuenta</label><input type="text" value={props.binanceForm.alias} onChange={(e) => props.onBinanceFormChange("alias", e.target.value)} placeholder="Ej: Demo principal Jeremias" /></div>
          <div className="calc-input-group"><label>API Key Demo Spot</label><input type="text" value={props.binanceForm.apiKey} onChange={(e) => props.onBinanceFormChange("apiKey", e.target.value)} placeholder="Pega tu API Key de Binance Demo Spot" /></div>
          <div className="calc-input-group"><label>API Secret Demo Spot</label><input type="password" value={props.binanceForm.apiSecret} onChange={(e) => props.onBinanceFormChange("apiSecret", e.target.value)} placeholder="Pega tu API Secret de Binance Demo Spot" /></div>
          <button className="btn-primary section-fill-button" onClick={props.onConnect}>Conectar Binance Demo Spot</button>
          <button className="btn-secondary-soft" type="button" onClick={props.onRefresh}>Actualizar resumen</button>
          <button className="btn-secondary-soft" type="button" onClick={props.onDisconnect}>Desconectar Binance Demo Spot</button>
        </div>

        {props.user.role === "admin" ? (
          <div className="profile-section">
            <h3>Administración de usuarios</h3>
            <p className="section-note with-bottom-gap">La app ya está preparada para usuarios en base de datos externa. Mientras Supabase no esté configurado en Vercel, seguirá usando un fallback sembrado.</p>
            <h4 className="section-heading-sm">Usuarios disponibles</h4>
            <div className="user-list">
              {props.users.map((user) => (
                <div className="user-item" key={user.username}>
                  <div>
                    <div className="text-strong">{user.username}</div>
                    <div className="text-xs-muted">{user.role === "admin" ? "Administrador" : "Genérico"}</div>
                  </div>
                  <div className="user-actions text-xs-soft">Backend fase 1</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
