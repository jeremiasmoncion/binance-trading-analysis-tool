import { useEffect, useRef, useState } from "react";
import { buildWorkspaceEntryHydrationPlan } from "../data-platform/workspaceHydration";
import { refreshBotDecisionsRuntime } from "./useBotDecisions";
import { refreshBotRegistryRuntime } from "./useSelectedBot";
import type { UserSession, ViewName } from "../types";

const WORKSPACE_ENTRY_HYDRATION_TIMEOUT_MS = 9_000;

interface UseWorkspaceEntryHydrationOptions {
  currentUser: UserSession | null;
  currentView: ViewName;
  hydrateConnectedView: (
    view: ViewName,
    options?: {
      previousView?: ViewName | null;
      preferInitialPlan?: boolean;
      forceFreshDashboard?: boolean;
    },
  ) => Promise<unknown>;
  refreshSignals: () => Promise<unknown>;
}

export function useWorkspaceEntryHydration({
  currentUser,
  currentView,
  hydrateConnectedView,
  refreshSignals,
}: UseWorkspaceEntryHydrationOptions) {
  const hydratedKeysRef = useRef<Set<string>>(new Set());
  const currentUsernameRef = useRef<string | null>(null);
  const lastStartedKeyRef = useRef("");
  const lastVisitedViewRef = useRef<ViewName | null>(null);
  const [hydrationVersion, setHydrationVersion] = useState(0);

  useEffect(() => {
    const nextUsername = currentUser?.username || null;
    if (currentUsernameRef.current === nextUsername) {
      return;
    }

    currentUsernameRef.current = nextUsername;
    hydratedKeysRef.current = new Set();
    lastStartedKeyRef.current = "";
    lastVisitedViewRef.current = null;
    setHydrationVersion((current) => current + 1);
  }, [currentUser?.username]);

  const username = currentUser?.username || "";
  const hydrationKey = username ? `${username}:${currentView}` : "";
  const plan = buildWorkspaceEntryHydrationPlan(currentView);
  const blockOnEntry = Boolean(hydrationKey && plan.blockOnFirstEntry && !hydratedKeysRef.current.has(hydrationKey));

  useEffect(() => {
    if (!currentUser || !hydrationKey) {
      return;
    }

    if (lastStartedKeyRef.current === hydrationKey) {
      return;
    }

    lastStartedKeyRef.current = hydrationKey;
    const previousView = lastVisitedViewRef.current;
    const shouldBlock = plan.blockOnFirstEntry && !hydratedKeysRef.current.has(hydrationKey);
    let cancelled = false;

    void (async () => {
      try {
        const hydrateTask = Promise.all([
          plan.refreshConnectedData
            ? hydrateConnectedView(currentView, {
                previousView,
                preferInitialPlan: shouldBlock,
                forceFreshDashboard: true,
              })
            : Promise.resolve(null),
          plan.refreshSignals ? refreshSignals() : Promise.resolve(null),
          plan.refreshBotRuntime
            ? Promise.all([
                refreshBotRegistryRuntime(true),
              refreshBotDecisionsRuntime(true),
            ])
            : Promise.resolve(null),
        ]).catch((error) => {
          console.error("Workspace entry hydration failed", error);
          return null;
        });

        await Promise.race([
          hydrateTask,
          new Promise((resolve) => {
            window.setTimeout(resolve, WORKSPACE_ENTRY_HYDRATION_TIMEOUT_MS);
          }),
        ]);
      } finally {
        lastVisitedViewRef.current = currentView;
        if (cancelled) {
          return;
        }
        hydratedKeysRef.current.add(hydrationKey);
        setHydrationVersion((current) => current + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    currentView,
    hydrateConnectedView,
    hydrationKey,
    hydrationVersion,
    plan.blockOnFirstEntry,
    plan.refreshBotRuntime,
    plan.refreshConnectedData,
    plan.refreshSignals,
    refreshSignals,
  ]);

  return {
    pending: blockOnEntry,
    detail: plan.detail,
  };
}
