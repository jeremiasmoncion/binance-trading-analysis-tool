import test from "node:test";
import assert from "node:assert/strict";

import { buildBotCanonicalTradeTimeline } from "../../src/domain/bots/tradeChain.ts";

function createDecision(overrides = {}) {
  return {
    id: "decision-1",
    botId: "bot-1",
    signalSnapshotId: 101,
    symbol: "BTC/USDT",
    timeframe: "5m",
    signalLayer: "operable",
    action: "execute",
    status: "approved",
    source: "manual",
    rationale: "Manual execute",
    executionEnvironment: "demo",
    automationMode: "assist",
    marketContextSignature: null,
    contextTags: [],
    metadata: {},
    createdAt: "2026-03-21T10:00:00.000Z",
    updatedAt: "2026-03-21T10:01:00.000Z",
    ...overrides,
  };
}

function createSignal(overrides = {}) {
  return {
    id: 101,
    coin: "BTC/USDT",
    timeframe: "5m",
    signal_label: "Comprar",
    signal_score: 82,
    outcome_status: "pending",
    outcome_pnl: 0,
    entry_price: 100,
    tp_price: 105,
    sl_price: 97,
    created_at: "2026-03-21T10:00:00.000Z",
    updated_at: "2026-03-21T10:01:00.000Z",
    signal_payload: {
      context: {
        direction: "BUY",
      },
    },
    ...overrides,
  };
}

function createOrder(overrides = {}) {
  return {
    id: 5001,
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
    created_at: "2026-03-21T10:02:00.000Z",
    last_synced_at: "2026-03-21T10:03:00.000Z",
    response_payload: {},
    ...overrides,
  };
}

test("canonical trade chain builds a BUY trade from direct signal execution linkage", () => {
  const trades = buildBotCanonicalTradeTimeline({
    decisionTimeline: [createDecision()],
    executionOrders: [createOrder()],
    signals: [createSignal({ execution_order_id: 5001, execution_status: "protected", execution_mode: "execute" })],
  });

  assert.equal(trades.length, 1);
  assert.equal(trades[0].orderId, 5001);
  assert.equal(trades[0].side, "BUY");
  assert.equal(trades[0].linkedBy, "execution-order-id");
  assert.equal(trades[0].signalId, 101);
});

test("canonical trade chain ignores blocked and preview-only records", () => {
  const trades = buildBotCanonicalTradeTimeline({
    decisionTimeline: [createDecision()],
    executionOrders: [
      createOrder({ id: 6001, mode: "preview", lifecycle_status: "preview", status: "preview" }),
      createOrder({ id: 6002, lifecycle_status: "blocked", status: "blocked" }),
    ],
    signals: [
      createSignal({ id: 201, execution_order_id: 6001 }),
      createSignal({ id: 202, execution_order_id: 6002 }),
    ],
  });

  assert.equal(trades.length, 0);
});

test("canonical trade chain resolves a trade through decision executionOrderId when signal link is missing", () => {
  const trades = buildBotCanonicalTradeTimeline({
    decisionTimeline: [
      createDecision({
        id: "decision-2",
        symbol: "ETH/USDT",
        timeframe: "1h",
        signalSnapshotId: 202,
        metadata: {
          executionOrderId: 7001,
        },
      }),
    ],
    executionOrders: [
      createOrder({
        id: 7001,
        signal_id: 0,
        coin: "ETH/USDT",
        timeframe: "1h",
        side: "SELL",
        current_price: 2400,
      }),
    ],
    signals: [
      createSignal({
        id: 202,
        coin: "ETH/USDT",
        timeframe: "1h",
        entry_price: 2400,
        tp_price: 2300,
        sl_price: 2450,
        signal_payload: {
          context: {
            direction: "SELL",
          },
        },
      }),
    ],
  });

  assert.equal(trades.length, 1);
  assert.equal(trades[0].side, "SELL");
  assert.equal(trades[0].linkedBy, "decision-order-id");
  assert.equal(trades[0].decisionId, "decision-2");
});

test("canonical trade chain prefers the most recent real execution for the same signal", () => {
  const trades = buildBotCanonicalTradeTimeline({
    decisionTimeline: [createDecision()],
    executionOrders: [
      createOrder({
        id: 8001,
        lifecycle_status: "blocked",
        status: "blocked",
        created_at: "2026-03-21T10:02:00.000Z",
      }),
      createOrder({
        id: 8002,
        lifecycle_status: "protected",
        status: "placed",
        created_at: "2026-03-21T10:05:00.000Z",
        last_synced_at: "2026-03-21T10:06:00.000Z",
      }),
    ],
    signals: [createSignal({ execution_order_id: undefined })],
  });

  assert.equal(trades.length, 1);
  assert.equal(trades[0].orderId, 8002);
});
