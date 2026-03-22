import type { ViewName } from "../types";
import { isBotOperationalView } from "./refreshPolicy.ts";

export function viewNeedsBotRuntimeBootstrap(view: ViewName) {
  return isBotOperationalView(view);
}

export function viewNeedsSharedSignalMemoryBootstrap(view: ViewName) {
  return view === "dashboard"
    || view === "market"
    || view === "memory"
    || isBotOperationalView(view);
}
