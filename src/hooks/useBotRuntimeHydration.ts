import { useEffect, useRef } from "react";
import { viewNeedsBotRuntimeBootstrap } from "../data-platform/botWorkspaceBootstrap";
import { refreshBotDecisionsRuntime } from "./useBotDecisions";
import { refreshBotRegistryRuntime } from "./useSelectedBot";
import type { UserSession, ViewName } from "../types";

interface UseBotRuntimeHydrationOptions {
  currentUser: UserSession | null;
  currentView: ViewName;
}

export function useBotRuntimeHydration({ currentUser, currentView }: UseBotRuntimeHydrationOptions) {
  const lastWarmupKeyRef = useRef("");

  useEffect(() => {
    if (!currentUser) {
      lastWarmupKeyRef.current = "";
      return;
    }

    if (!viewNeedsBotRuntimeBootstrap(currentView)) {
      return;
    }

    const nextKey = `${currentUser.username}:${currentView}`;
    if (lastWarmupKeyRef.current === nextKey) {
      return;
    }

    lastWarmupKeyRef.current = nextKey;
    void Promise.all([
      refreshBotRegistryRuntime(true),
      refreshBotDecisionsRuntime(true),
    ]);
  }, [currentUser, currentView]);
}
