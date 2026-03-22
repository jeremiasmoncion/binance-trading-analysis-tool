import type { ViewName } from "../types";
import { viewNeedsBotRuntimeBootstrap, viewNeedsSharedSignalMemoryBootstrap } from "./botWorkspaceBootstrap.ts";

export interface WorkspaceEntryHydrationPlan {
  refreshSignals: boolean;
  refreshBotRuntime: boolean;
  blockOnFirstEntry: boolean;
  detail: string;
}

export function buildWorkspaceEntryHydrationPlan(view: ViewName): WorkspaceEntryHydrationPlan {
  const refreshSignals = viewNeedsSharedSignalMemoryBootstrap(view);
  const refreshBotRuntime = viewNeedsBotRuntimeBootstrap(view);
  // Navigation between live surfaces should feel immediate. We still refresh
  // the relevant domains on first entry, but the shell no longer blocks the
  // whole screen while those refreshes land.
  const blockOnFirstEntry = false;

  if (view === "dashboard") {
    return {
      refreshSignals,
      refreshBotRuntime,
      blockOnFirstEntry,
      detail: "Sincronizando capital, rendimiento y estado general antes de abrir el dashboard.",
    };
  }

  if (view === "balance") {
    return {
      refreshSignals,
      refreshBotRuntime,
      blockOnFirstEntry,
      detail: "Actualizando balance y posiciones antes de abrir My Wallet.",
    };
  }

  if (view === "control-bot-settings" || view === "bots") {
    return {
      refreshSignals,
      refreshBotRuntime,
      blockOnFirstEntry,
      detail: "Sincronizando bots, señales y ejecución antes de abrir Bot Settings.",
    };
  }

  if (view === "ai-signal-bot" || view === "signals") {
    return {
      refreshSignals,
      refreshBotRuntime,
      blockOnFirstEntry,
      detail: "Sincronizando señales, historial y runtime del bot antes de abrir Signal Bot.",
    };
  }

  return {
    refreshSignals,
    refreshBotRuntime,
    blockOnFirstEntry,
    detail: "Sincronizando el workspace inicial.",
  };
}
