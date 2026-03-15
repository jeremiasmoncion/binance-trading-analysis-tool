import type { AuthMode } from "../types";

interface LoginOverlayProps {
  authMode: AuthMode;
  error: string;
  loginForm: { username: string; password: string };
  registerForm: { displayName: string; email: string; password: string };
  onToggleMode: () => void;
  onLoginChange: (field: "username" | "password", value: string) => void;
  onRegisterChange: (field: "displayName" | "email" | "password", value: string) => void;
  onLoginSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRegisterSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function LoginOverlay(props: LoginOverlayProps) {
  const isLogin = props.authMode === "login";

  return (
    <div className="login-overlay">
      <div className="login-box">
        <div className="login-logo">
          <div className="logo-icon">C</div>
          <h2>CRYPE</h2>
          <p className="login-subtitle">{isLogin ? "Radar Inteligente de Trading" : "Crea tu acceso para empezar"}</p>
        </div>

        <div className={`login-error${props.error ? " is-visible" : ""}`}>
          {props.error}
        </div>

        {isLogin ? (
          <form className="login-form" onSubmit={props.onLoginSubmit}>
            <input
              type="text"
              placeholder="Usuario o correo"
              value={props.loginForm.username}
              onChange={(event) => props.onLoginChange("username", event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={props.loginForm.password}
              onChange={(event) => props.onLoginChange("password", event.target.value)}
              required
            />
            <button type="submit" className="btn-login">
              Iniciar Sesión
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={props.onRegisterSubmit}>
            <input
              type="text"
              placeholder="Nombre completo"
              value={props.registerForm.displayName}
              onChange={(event) => props.onRegisterChange("displayName", event.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Correo"
              value={props.registerForm.email}
              onChange={(event) => props.onRegisterChange("email", event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={props.registerForm.password}
              onChange={(event) => props.onRegisterChange("password", event.target.value)}
              required
            />
            <button type="submit" className="btn-login">
              Crear cuenta
            </button>
          </form>
        )}

        <div className="login-switch">
          <span>{isLogin ? "¿No tienes usuario?" : "¿Ya tienes cuenta?"}</span> <button type="button" onClick={props.onToggleMode}>{isLogin ? "Crear cuenta" : "Volver al login"}</button>
        </div>
        <div className="login-hint">{isLogin ? "Los usuarios nuevos entran como cuenta genérica." : "Usa tu correo como acceso al crear la cuenta."}</div>
      </div>
    </div>
  );
}
