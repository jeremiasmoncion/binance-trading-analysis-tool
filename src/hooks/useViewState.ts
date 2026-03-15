import { useState } from "react";
import type { ViewName } from "../types";

export function useViewState(initialView: ViewName = "dashboard") {
  const [currentView, setCurrentView] = useState<ViewName>(initialView);

  return {
    currentView,
    setCurrentView,
    openProfile() {
      setCurrentView("profile");
    },
    resetToDashboard() {
      setCurrentView("dashboard");
    },
  };
}
