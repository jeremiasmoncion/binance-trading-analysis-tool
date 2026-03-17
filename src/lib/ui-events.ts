export type UiToastTone = "success" | "error" | "warning" | "info";

export interface UiToastPayload {
  id?: string;
  tone: UiToastTone;
  title: string;
  message?: string;
  durationMs?: number;
}

export interface UiHelpPayload {
  title: string;
  body?: string;
  bullets?: string[];
  footer?: string;
}

export interface UiLoadingPayload {
  id: string;
  label: string;
  detail?: string;
}

const TOAST_EVENT = "crype:toast";
const HELP_EVENT = "crype:help";
const HELP_CLOSE_EVENT = "crype:help-close";
const LOADING_START_EVENT = "crype:loading-start";
const LOADING_STOP_EVENT = "crype:loading-stop";

function emitEvent<T>(name: string, detail: T) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<T>(name, { detail }));
}

export function showToast(payload: UiToastPayload) {
  emitEvent(TOAST_EVENT, payload);
}

export function openHelp(payload: UiHelpPayload) {
  emitEvent(HELP_EVENT, payload);
}

export function closeHelp() {
  emitEvent(HELP_CLOSE_EVENT, {});
}

export function startLoading(payload: Omit<UiLoadingPayload, "id"> & { id?: string }) {
  const id = payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  emitEvent(LOADING_START_EVENT, { ...payload, id });
  return id;
}

export function stopLoading(id: string) {
  emitEvent(LOADING_STOP_EVENT, { id });
}

export function onToast(handler: (payload: UiToastPayload) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<UiToastPayload>).detail);
  window.addEventListener(TOAST_EVENT, listener);
  return () => window.removeEventListener(TOAST_EVENT, listener);
}

export function onHelp(handler: (payload: UiHelpPayload) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<UiHelpPayload>).detail);
  window.addEventListener(HELP_EVENT, listener);
  return () => window.removeEventListener(HELP_EVENT, listener);
}

export function onHelpClose(handler: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => handler();
  window.addEventListener(HELP_CLOSE_EVENT, listener);
  return () => window.removeEventListener(HELP_CLOSE_EVENT, listener);
}

export function onLoadingStart(handler: (payload: UiLoadingPayload) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<UiLoadingPayload>).detail);
  window.addEventListener(LOADING_START_EVENT, listener);
  return () => window.removeEventListener(LOADING_START_EVENT, listener);
}

export function onLoadingStop(handler: (payload: { id: string }) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<{ id: string }>).detail);
  window.addEventListener(LOADING_STOP_EVENT, listener);
  return () => window.removeEventListener(LOADING_STOP_EVENT, listener);
}
