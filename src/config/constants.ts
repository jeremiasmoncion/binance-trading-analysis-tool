export const POPULAR_COINS = [
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "SOL/USDT",
  "XRP/USDT",
  "ADA/USDT",
  "DOGE/USDT",
  "MATIC/USDT",
  "LINK/USDT",
  "AVAX/USDT",
];

export const TIMEFRAME_OPTIONS = [
  ["1s", "1 segundo"],
  ["1m", "1 minuto"],
  ["3m", "3 minutos"],
  ["5m", "5 minutos"],
  ["15m", "15 minutos"],
  ["30m", "30 minutos"],
  ["1h", "1 hora"],
  ["2h", "2 horas"],
  ["4h", "4 horas"],
  ["6h", "6 horas"],
  ["8h", "8 horas"],
  ["12h", "12 horas"],
  ["1d", "1 día"],
] as const;

export const MAP_TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];

export const PERIOD_OPTIONS = [
  ["1d", "Comparar con ayer"],
  ["7d", "Comparar con 7 días"],
  ["30d", "Comparar con 30 días"],
] as const;
