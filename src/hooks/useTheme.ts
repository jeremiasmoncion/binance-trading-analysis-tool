import { useCallback, useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("crype_theme") as "light" | "dark" | null) || "dark";
    setTheme(savedTheme);
    document.body.classList.toggle("dark-theme", savedTheme === "dark");
    document.body.classList.toggle("light-theme", savedTheme === "light");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-theme", theme === "dark");
    document.body.classList.toggle("light-theme", theme === "light");
    localStorage.setItem("crype_theme", theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: useCallback(() => {
      setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    }, []),
  };
}
