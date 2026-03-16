import { useEffect, useState } from "react";
import type { ViewName } from "../types";

const SIDEBAR_STORAGE_KEY = "crype-sidebar-collapsed";

export function useViewState(initialView: ViewName = "dashboard") {
  const [currentView, setCurrentView] = useState<ViewName>(initialView);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {
      setSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore persistence errors
    }
  }, [sidebarCollapsed]);

  return {
    currentView,
    setCurrentView,
    sidebarCollapsed,
    toggleSidebar() {
      setSidebarCollapsed((current) => !current);
    },
    openProfile() {
      setCurrentView("profile");
    },
    resetToDashboard() {
      setCurrentView("dashboard");
    },
  };
}
