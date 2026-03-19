import { createDataPlaneStore, useDataPlaneStore } from "./createDataPlaneStore";
import type { SystemDataPlane } from "./contracts";

const initialSystemDataPlane: SystemDataPlane = {
  meta: {
    status: "idle",
    source: "bootstrap",
    lastFullSyncAt: null,
    lastOverlayAt: null,
    lastStreamAt: null,
    lastError: null,
  },
  connection: null,
  portfolio: null,
  execution: null,
  dashboardSummary: null,
  signalMemory: [],
  watchlists: [],
  activeWatchlistName: "Principal",
};

export const systemDataPlaneStore = createDataPlaneStore(initialSystemDataPlane);

export function useSystemDataPlane<TSelection>(selector: (state: SystemDataPlane) => TSelection) {
  return useDataPlaneStore(systemDataPlaneStore, selector);
}
