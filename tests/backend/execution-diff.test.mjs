import test from "node:test";
import assert from "node:assert/strict";

import { hasExecutionCenterChanged, hasExecutionOrdersChanged } from "../../src/data-platform/executionDiff.ts";

function createOrder(overrides = {}) {
  return {
    id: 501,
    username: "jeremias",
    signal_id: 101,
    coin: "BTC/USDT",
    timeframe: "5m",
    side: "BUY",
    quantity: 1,
    notional_usd: 100,
    current_price: 100,
    mode: "execute",
    status: "placed",
    lifecycle_status: "protected",
    signal_outcome_status: "pending",
    realized_pnl: 0,
    order_id: 777,
    client_order_id: "demo-777",
    created_at: "2026-03-22T10:00:00.000Z",
    last_synced_at: "2026-03-22T10:05:00.000Z",
    response_payload: {
      botContext: {
        botId: "signal-bot-1",
        botName: "Signal Bot 1",
      },
    },
    ...overrides,
  };
}

function createExecutionCenter(orderOverrides = {}) {
  return {
    profile: {
      enabled: true,
      autoExecuteEnabled: true,
      updatedAt: "2026-03-22T10:05:00.000Z",
      allowedStrategies: [],
      allowedTimeframes: [],
      scopeOverrides: [],
    },
    account: {
      connected: true,
      alias: "Binance Demo",
      cashValue: 5000,
      totalValue: 10000,
      openOrdersCount: 0,
      dailyLossPct: 0,
      dailyAutoExecutions: 0,
      recentLossStreak: 0,
      autoExecutionRemaining: 5,
    },
    candidates: [],
    recentOrders: [createOrder(orderOverrides)],
  };
}

test("execution diff detects botContext attribution changes", () => {
  const current = [createOrder()];
  const next = [createOrder({
    response_payload: {
      botContext: {
        botId: "signal-bot-2",
        botName: "Signal Bot 2",
      },
    },
  })];

  assert.equal(hasExecutionOrdersChanged(current, next), true);
});

test("execution diff ignores identical semantic orders", () => {
  const current = [createOrder()];
  const next = [createOrder()];

  assert.equal(hasExecutionOrdersChanged(current, next), false);
});

test("execution center diff detects repaired bot attribution", () => {
  const current = createExecutionCenter();
  const next = createExecutionCenter({
    response_payload: {
      botContext: {
        botId: "signal-bot-2",
        botName: "Signal Bot 2",
      },
    },
  });

  assert.equal(hasExecutionCenterChanged(current, next), true);
});
