import { formatPrice } from "./format";
import { calcSMA } from "./trading";
import type { Candle } from "../types";

export function drawChart(
  canvas: HTMLCanvasElement | null,
  candles: Candle[],
  isDark: boolean,
) {
  if (!canvas || !candles.length) return;
  const ctx = canvas.getContext("2d");
  const container = canvas.parentElement;
  if (!ctx || !container) return;

  canvas.width = container.clientWidth - 40;
  canvas.height = 380;

  const chartBg = isDark ? "#0b1220" : "#fafafa";
  const gridColor = isDark ? "#243041" : "#e5e7eb";
  const labelColor = isDark ? "#94a3b8" : "#6b7280";
  const padding = { top: 20, right: 60, bottom: 30, left: 10 };
  const width = canvas.width - padding.left - padding.right;
  const height = canvas.height - padding.top - padding.bottom;

  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || 1;
  const candleW = Math.max(4, width / candles.length - 2);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = chartBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(canvas.width - padding.right, y);
    ctx.stroke();
  }

  candles.forEach((candle, i) => {
    const x = padding.left + i * (candleW + 2) + candleW / 2;
    const isUp = candle.close >= candle.open;
    const color = isUp ? "#22c55e" : "#ef4444";
    const yOpen = padding.top + height - ((candle.open - minP) / range) * height;
    const yClose = padding.top + height - ((candle.close - minP) / range) * height;
    const yHigh = padding.top + height - ((candle.high - minP) / range) * height;
    const yLow = padding.top + height - ((candle.low - minP) / range) * height;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillRect(x - candleW / 2, Math.min(yOpen, yClose), candleW, Math.max(1, Math.abs(yClose - yOpen)));
  });

  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 20; i < candles.length; i += 1) {
    const sma = calcSMA(candles.slice(0, i + 1), 20);
    const x = padding.left + i * (candleW + 2) + candleW / 2;
    const y = padding.top + height - ((sma - minP) / range) * height;
    if (i === 20) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 50; i < candles.length; i += 1) {
    const sma = calcSMA(candles.slice(0, i + 1), 50);
    const x = padding.left + i * (candleW + 2) + candleW / 2;
    const y = padding.top + height - ((sma - minP) / range) * height;
    if (i === 50) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = labelColor;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  for (let i = 0; i <= 4; i += 1) {
    const price = maxP - (range / 4) * i;
    const y = padding.top + (height / 4) * i + 4;
    ctx.fillText(formatPrice(price), canvas.width - padding.right + 5, y);
  }
}

interface PerformancePoint {
  label: string;
  portfolio: number;
  benchmark: number;
}

interface BotComparisonBar {
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
}

export function drawPerformanceChart(
  canvas: HTMLCanvasElement | null,
  points: PerformancePoint[],
  isDark: boolean,
) {
  if (!canvas || points.length < 2) return;
  const ctx = canvas.getContext("2d");
  const container = canvas.parentElement;
  if (!ctx || !container) return;

  canvas.width = Math.max(320, container.clientWidth - 40);
  canvas.height = 420;

  const chartBg = isDark ? "#0b1018" : "#ffffff";
  const gridColor = isDark ? "rgba(71, 85, 105, 0.28)" : "rgba(148, 163, 184, 0.22)";
  const labelColor = isDark ? "#94a3b8" : "#64748b";
  const portfolioLine = "#6f6bff";
  const benchmarkLine = isDark ? "#94a3b8" : "#94a3b8";
  const padding = { top: 24, right: 72, bottom: 38, left: 18 };
  const width = canvas.width - padding.left - padding.right;
  const height = canvas.height - padding.top - padding.bottom;
  const allValues = points.flatMap((point) => [point.portfolio, point.benchmark]);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const range = maxValue - minValue || 1;
  const stepX = width / Math.max(1, points.length - 1);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = chartBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(canvas.width - padding.right, y);
    ctx.stroke();
  }

  const toX = (index: number) => padding.left + index * stepX;
  const toY = (value: number) => padding.top + height - ((value - minValue) / range) * height;

  ctx.beginPath();
  points.forEach((point, index) => {
    const x = toX(index);
    const y = toY(point.portfolio);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineWidth = 3;
  ctx.strokeStyle = portfolioLine;
  ctx.stroke();

  ctx.lineTo(toX(points.length - 1), padding.top + height);
  ctx.lineTo(toX(0), padding.top + height);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, padding.top, 0, padding.top + height);
  fill.addColorStop(0, isDark ? "rgba(111, 107, 255, 0.28)" : "rgba(111, 107, 255, 0.18)");
  fill.addColorStop(1, isDark ? "rgba(111, 107, 255, 0.04)" : "rgba(111, 107, 255, 0.02)");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    const x = toX(index);
    const y = toY(point.benchmark);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = benchmarkLine;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = labelColor;
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "left";
  for (let i = 0; i <= 4; i += 1) {
    const value = maxValue - (range / 4) * i;
    const y = padding.top + (height / 4) * i + 4;
    ctx.fillText(formatPrice(value), canvas.width - padding.right + 8, y);
  }

  const xTickIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  ctx.textAlign = "center";
  xTickIndexes.forEach((index) => {
    const point = points[index];
    if (!point) return;
    ctx.fillText(point.label, toX(index), canvas.height - 10);
  });
}

export function drawBotComparisonChart(
  canvas: HTMLCanvasElement | null,
  bars: BotComparisonBar[],
  isDark: boolean,
) {
  if (!canvas || !bars.length) return;
  const ctx = canvas.getContext("2d");
  const container = canvas.parentElement;
  if (!ctx || !container) return;

  canvas.width = Math.max(320, container.clientWidth - 40);
  canvas.height = 420;

  const chartBg = isDark ? "#0b1018" : "#ffffff";
  const gridColor = isDark ? "rgba(71, 85, 105, 0.28)" : "rgba(148, 163, 184, 0.22)";
  const labelColor = isDark ? "#94a3b8" : "#64748b";
  const padding = { top: 28, right: 28, bottom: 52, left: 54 };
  const width = canvas.width - padding.left - padding.right;
  const height = canvas.height - padding.top - padding.bottom;
  const maxAbs = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1);
  const topValue = maxAbs * 1.15;
  const bottomValue = Math.min(0, -maxAbs * 0.2);
  const range = topValue - bottomValue || 1;
  const stepX = width / Math.max(1, bars.length);
  const barWidth = Math.min(140, stepX * 0.72);
  const zeroY = padding.top + height - ((0 - bottomValue) / range) * height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = chartBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = padding.top + (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(canvas.width - padding.right, y);
    ctx.stroke();
  }

  const toY = (value: number) => padding.top + height - ((value - bottomValue) / range) * height;

  bars.forEach((bar, index) => {
    const x = padding.left + stepX * index + (stepX - barWidth) / 2;
    const y = toY(bar.value);
    const barTop = Math.min(zeroY, y);
    const barHeight = Math.max(4, Math.abs(y - zeroY));
    const radius = 10;

    ctx.beginPath();
    roundRectPath(ctx, x, barTop, barWidth, barHeight, radius);
    ctx.fillStyle = bar.tone === "negative"
      ? "#ef4444"
      : bar.tone === "neutral"
        ? "#94a3b8"
        : "#33b27b";
    ctx.fill();

    ctx.fillStyle = labelColor;
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(bar.label, x + barWidth / 2, canvas.height - 16);
  });

  ctx.fillStyle = labelColor;
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i += 1) {
    const value = topValue - (range / 5) * i;
    const y = padding.top + (height / 5) * i + 4;
    ctx.fillText(formatPrice(value), padding.left - 10, y);
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const nextRadius = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + nextRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, nextRadius);
  ctx.arcTo(x + width, y + height, x, y + height, nextRadius);
  ctx.arcTo(x, y + height, x, y, nextRadius);
  ctx.arcTo(x, y, x + width, y, nextRadius);
  ctx.closePath();
}
