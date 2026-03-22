import { useCallback, useState } from "react";
import { authService } from "../services/api";
import type { AuthMode, UserSession } from "../types";

interface LoginFormState {
  username: string;
  password: string;
}

interface RegisterFormState {
  displayName: string;
  email: string;
  password: string;
}

type AuthCallback = () => Promise<void> | void;

const AUTH_SESSION_RETRY_WINDOW_MS = 8_000;
const AUTH_SESSION_RETRY_INTERVAL_MS = 250;
const AUTH_SESSION_POLL_TIMEOUT_MS = 1_500;

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authPending, setAuthPending] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginForm, setLoginForm] = useState<LoginFormState>({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({ displayName: "", email: "", password: "" });

  const runAuthenticatedBootstrap = useCallback((callback?: AuthCallback, context = "session restore") => {
    if (!callback) return;
    void Promise.resolve()
      .then(() => callback())
      .catch((error) => {
        console.error(`Initial workspace bootstrap failed during ${context}`, error);
      });
  }, []);

  const resolveAuthenticatedSession = useCallback(async () => {
    const deadline = Date.now() + AUTH_SESSION_RETRY_WINDOW_MS;

    while (Date.now() < deadline) {
      const session = await authService.getSession(AUTH_SESSION_POLL_TIMEOUT_MS);
      if (session) {
        return session;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, AUTH_SESSION_RETRY_INTERVAL_MS);
      });
    }

    return null;
  }, []);

  const bootstrapSession = useCallback(async (onAuthenticated?: AuthCallback) => {
    setAuthPending(true);
    try {
      const session = await authService.getSession();
      if (!session) return null;
      setCurrentUser(session);
      runAuthenticatedBootstrap(onAuthenticated, "session restore");
      return session;
    } finally {
      setAuthPending(false);
    }
  }, [runAuthenticatedBootstrap]);

  const handleLogin = useCallback(async (
    event: React.FormEvent<HTMLFormElement>,
    onAuthenticated?: AuthCallback,
  ) => {
    event.preventDefault();
    setLoginError("");
    setAuthPending(true);
    try {
      await authService.login(loginForm.username.trim(), loginForm.password);
      const session = await resolveAuthenticatedSession();
      if (!session) {
        throw new Error("La sesión no se confirmó a tiempo después del inicio de sesión");
      }
      setCurrentUser(session);
      runAuthenticatedBootstrap(onAuthenticated, "login");
      setLoginForm({ username: "", password: "" });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión");
    } finally {
      setAuthPending(false);
    }
  }, [loginForm, resolveAuthenticatedSession, runAuthenticatedBootstrap]);

  const handleRegister = useCallback(async (
    event: React.FormEvent<HTMLFormElement>,
    onAuthenticated?: AuthCallback,
  ) => {
    event.preventDefault();
    setLoginError("");
    setAuthPending(true);
    try {
      await authService.register(registerForm.displayName.trim(), registerForm.email.trim(), registerForm.password);
      const session = await resolveAuthenticatedSession();
      if (!session) {
        throw new Error("La sesión no se confirmó a tiempo después del registro");
      }
      setCurrentUser(session);
      runAuthenticatedBootstrap(onAuthenticated, "register");
      setRegisterForm({ displayName: "", email: "", password: "" });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo crear la cuenta");
    } finally {
      setAuthPending(false);
    }
  }, [registerForm, resolveAuthenticatedSession, runAuthenticatedBootstrap]);

  const handleLogout = useCallback(async (onLogout?: AuthCallback) => {
    await authService.logout();
    setCurrentUser(null);
    setLoginError("");
    setAuthMode("login");
    await onLogout?.();
  }, []);

  return {
    currentUser,
    authMode,
    authPending,
    loginError,
    loginForm,
    registerForm,
    toggleAuthMode() {
      setAuthMode((prev) => (prev === "login" ? "register" : "login"));
    },
    setLoginField(field: keyof LoginFormState, value: string) {
      setLoginForm((prev) => ({ ...prev, [field]: value }));
    },
    setRegisterField(field: keyof RegisterFormState, value: string) {
      setRegisterForm((prev) => ({ ...prev, [field]: value }));
    },
    bootstrapSession,
    handleLogin,
    handleRegister,
    handleLogout,
  };
}
