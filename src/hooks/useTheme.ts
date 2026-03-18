import { useEffect, useState, type RefObject } from "react";
import type { Candle } from "../types";

export function useTheme(chartRef: RefObject<HTMLCanvasElement | null>, candles: Candle[]) {
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
  }, [theme, candles, chartRef]);

  return {
    theme,
    toggleTheme() {
      setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    },
  };
}
