import { useCallback, useEffect, useMemo, useState } from "react";
import type { ViewName } from "../types";

const SIDEBAR_STORAGE_KEY = "crype-sidebar-collapsed";

export function useViewState(initialView: ViewName = "dashboard") {
  const [currentView, setCurrentView] = useState<ViewName>(initialView);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (window.innerWidth <= 1024) {
        setSidebarCollapsed(true);
        return;
      }
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

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => !current);
  }, []);

  const openProfile = useCallback(() => {
    setCurrentView("profile");
  }, []);

  const resetToDashboard = useCallback(() => {
    setCurrentView("dashboard");
  }, []);

  return useMemo(() => ({
    currentView,
    setCurrentView,
    sidebarCollapsed,
    // The shell depends on these handlers at the top of the tree. Keeping them
    // stable avoids rebroadcasting fresh callback props across Sidebar/TopBar
    // every time unrelated market or system state updates.
    toggleSidebar,
    openProfile,
    resetToDashboard,
  }), [currentView, openProfile, resetToDashboard, sidebarCollapsed, toggleSidebar]);
}
