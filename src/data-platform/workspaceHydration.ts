import type { ViewName } from "../types";
import { viewNeedsBotRuntimeBootstrap, viewNeedsSharedSignalMemoryBootstrap } from "./botWorkspaceBootstrap.ts";
import { isBotOperationalView } from "./refreshPolicy.ts";

export interface WorkspaceEntryHydrationPlan {
  refreshConnectedData: boolean;
  refreshSignals: boolean;
  refreshBotRuntime: boolean;
  blockOnFirstEntry: boolean;
  detail: string;
}

export function buildWorkspaceEntryHydrationPlan(view: ViewName): WorkspaceEntryHydrationPlan {
  const refreshConnectedData = view === "dashboard" || view === "balance" || isBotOperationalView(view);
  const refreshSignals = viewNeedsSharedSignalMemoryBootstrap(view);
  const refreshBotRuntime = viewNeedsBotRuntimeBootstrap(view);
  // Navigation between live surfaces should feel immediate. We still refresh
  // the relevant domains on first entry, but the shell no longer blocks the
  // whole screen while those refreshes land.
  const blockOnFirstEntry = false;

  if (view === "dashboard") {
    return {
      refreshConnectedData,
      refreshSignals,
      refreshBotRuntime,
      blockOnFirstEntry,
      detail: "Sincronizando capital, rendimiento y estado general antes de abrir el dashboard.",
    };
  }

  if (view === "balance") {
    return {
      refreshConnectedData,
      refreshSignals,
      refreshBotRuntime,
      blockOnFirstEntry,
      detail: "Actualizando balance y posiciones antes de abrir My Wallet.",
    };
  }

  if (view === "control-bot-settings" || view === "bots") {
    return {
      refreshConnectedData,
      refreshSignals,
      refreshBotRuntime,
      blockOnFirstEntry,
      detail: "Sincronizando bots, señales y ejecución antes de abrir Bot Settings.",
    };
  }

  if (view === "ai-signal-bot" || view === "signals") {
    return {
      refreshConnectedData,
      refreshSignals,
      refreshBotRuntime,
      blockOnFirstEntry,
      detail: "Sincronizando señales, historial y runtime del bot antes de abrir Signal Bot.",
    };
  }

  return {
    refreshConnectedData,
    refreshSignals,
    refreshBotRuntime,
    blockOnFirstEntry,
    detail: "Sincronizando el workspace inicial.",
  };
}
