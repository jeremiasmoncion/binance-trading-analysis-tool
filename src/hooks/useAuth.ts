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
  const [loginError, setLoginError] = useState("");
  const [loginForm, setLoginForm] = useState<LoginFormState>({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({ displayName: "", email: "", password: "" });

  const bootstrapSession = useCallback(async () => {
    const session = await authService.getSession();
    if (session) {
      setCurrentUser(session);
    }
    return session;
  }, []);

  const handleLogin = useCallback(async (
    event: React.FormEvent<HTMLFormElement>,
    onAuthenticated?: AuthCallback,
  ) => {
    event.preventDefault();
    setLoginError("");
    try {
      await authService.login(loginForm.username.trim(), loginForm.password);
      const session = await authService.getSession();
      if (!session) return;
      setCurrentUser(session);
      setLoginForm({ username: "", password: "" });
      await onAuthenticated?.();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión");
    }
  }, [loginForm]);

  const handleRegister = useCallback(async (
    event: React.FormEvent<HTMLFormElement>,
    onAuthenticated?: AuthCallback,
  ) => {
    event.preventDefault();
    setLoginError("");
    try {
      await authService.register(registerForm.displayName.trim(), registerForm.email.trim(), registerForm.password);
      const session = await authService.getSession();
      if (!session) return;
      setCurrentUser(session);
      setRegisterForm({ displayName: "", email: "", password: "" });
      await onAuthenticated?.();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo crear la cuenta");
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
