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
