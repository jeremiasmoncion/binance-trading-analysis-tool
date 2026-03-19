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

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authPending, setAuthPending] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginForm, setLoginForm] = useState<LoginFormState>({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({ displayName: "", email: "", password: "" });

  const bootstrapSession = useCallback(async (onAuthenticated?: AuthCallback) => {
    setAuthPending(true);
    try {
      const session = await authService.getSession();
      if (!session) return null;
      // Keep the authenticated shell gated until the initial workspace bootstrap finishes.
      await onAuthenticated?.();
      setCurrentUser(session);
      return session;
    } finally {
      setAuthPending(false);
    }
  }, []);

  const handleLogin = useCallback(async (
    event: React.FormEvent<HTMLFormElement>,
    onAuthenticated?: AuthCallback,
  ) => {
    event.preventDefault();
    setLoginError("");
    setAuthPending(true);
    try {
      await authService.login(loginForm.username.trim(), loginForm.password);
      const session = await authService.getSession();
      if (!session) return;
      await onAuthenticated?.();
      setCurrentUser(session);
      setLoginForm({ username: "", password: "" });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión");
    } finally {
      setAuthPending(false);
    }
  }, [loginForm]);

  const handleRegister = useCallback(async (
    event: React.FormEvent<HTMLFormElement>,
    onAuthenticated?: AuthCallback,
  ) => {
    event.preventDefault();
    setLoginError("");
    setAuthPending(true);
    try {
      await authService.register(registerForm.displayName.trim(), registerForm.email.trim(), registerForm.password);
      const session = await authService.getSession();
      if (!session) return;
      await onAuthenticated?.();
      setCurrentUser(session);
      setRegisterForm({ displayName: "", email: "", password: "" });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo crear la cuenta");
    } finally {
      setAuthPending(false);
    }
  }, [registerForm]);

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
