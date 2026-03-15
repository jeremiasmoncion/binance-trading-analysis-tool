import { useEffect, useState, type RefObject } from "react";
import { drawChart } from "../lib/chart";
import type { Candle } from "../types";

export function useTheme(chartRef: RefObject<HTMLCanvasElement | null>, candles: Candle[]) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("crype_theme") as "light" | "dark" | null) || "dark";
    setTheme(savedTheme);
    document.body.classList.toggle("dark-theme", savedTheme === "dark");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-theme", theme === "dark");
    localStorage.setItem("crype_theme", theme);
    drawChart(chartRef.current, candles, theme === "dark");
  }, [theme, candles, chartRef]);

  return {
    theme,
    toggleTheme() {
      setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    },
  };
}
