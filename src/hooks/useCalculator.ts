import { useMemo, useState } from "react";
import type { Indicators, OperationPlan } from "../types";

interface CalculatorState {
  capital: string;
  entry: string;
  percent: string;
  stopPct: string;
}

export function useCalculator(indicators: Indicators | null, plan: OperationPlan | null) {
  const [calculator, setCalculator] = useState<CalculatorState>({
    capital: "0",
    entry: "",
    percent: "1.5",
    stopPct: "1.0",
  });

  const capitalValue = Number(calculator.capital) || 0;

  const result = useMemo(() => {
    const capital = capitalValue;
    const entry = Number(calculator.entry) || indicators?.current || 0;
    const pct = Number(calculator.percent) || 0;
    const stopPct = Number(calculator.stopPct) || 0;
    const exitPrice = entry * (1 + pct / 100);
    const gross = capital * pct / 100;
    const commission = capital * 0.002;
    const net = gross - commission;
    const netPct = capital ? (net / capital) * 100 : 0;
    const breakEven = entry * 1.002;
    const stopPrice = entry * (1 - stopPct / 100);
    const stopLoss = capital * stopPct / 100;
    return { exitPrice, gross, commission, net, netPct, breakEven, stopPrice, stopLoss };
  }, [calculator, capitalValue, indicators]);

  return {
    calculator,
    capitalValue,
    result,
    setField(field: keyof CalculatorState, value: string) {
      setCalculator((prev) => ({ ...prev, [field]: value }));
    },
    applySuggestedPlan() {
      if (!plan) return;
      const tpPct = ((plan.tp - plan.entry) / plan.entry) * 100;
      const slPct = ((plan.entry - plan.sl) / plan.entry) * 100;
      setCalculator((prev) => ({
        ...prev,
        entry: plan.entry.toFixed(2),
        percent: tpPct.toFixed(2),
        stopPct: slPct.toFixed(2),
      }));
    },
    useCurrentPrice() {
      if (!indicators?.current) return;
      setCalculator((prev) => ({ ...prev, entry: indicators.current.toFixed(2) || prev.entry }));
    },
  };
}
