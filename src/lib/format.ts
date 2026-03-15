export function formatPrice(value: number) {
  const amount = Number(value || 0);
  let decimals = 2;
  if (amount !== 0 && Math.abs(amount) < 1) decimals = 6;
  if (amount !== 0 && Math.abs(amount) < 0.01) decimals = 8;
  if (amount !== 0 && Math.abs(amount) < 0.0001) decimals = 10;

  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatAmount(value: number) {
  const amount = Number(value || 0);
  let decimals = 4;
  if (amount >= 1000) decimals = 2;
  if (amount !== 0 && Math.abs(amount) < 1) decimals = 6;

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatPct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export function formatSignedPrice(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatPrice(Math.abs(value || 0))}`;
}

export function formatSignedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${formatPct(value)}`;
}

export function nowTime() {
  return new Date().toLocaleTimeString("es-ES");
}
