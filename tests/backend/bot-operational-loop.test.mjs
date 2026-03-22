import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateExecutionGuardrails,
  getBotReadyContentionSummary,
  getDispatchSignalId,
  getIntentLaneForBot,
  resolveAutomatedIntent,
} from "../../src/domain/bots/operationalLoop.ts";

function createBot(overrides = {}) {
  return {
    id: "bot-1",
    name: "Signal Bot Auto",
    status: "active",
    automationMode: "auto",
    executionEnvironment: "demo",
    capital: {
      allocatedUsd: 1000,
      availableUsd: 1000,
    },
    riskPolicy: {
      maxPositionUsd: 100,
      maxOpenPositions: 2,
      maxSymbolExposurePct: 50,
    },
    overlapPolicy: {
      executionOverlap: "block",
    },
    executionPolicy: {
      canOpenPositions: true,
      suggestionsOnly: false,
      requiresHumanApproval: false,
      autoExecutionEnabled: true,
      realExecutionEnabled: false,
    },
    workspaceSettings: {
      primaryPair: "BTC/USDT",
    },
    ...overrides,
  };
}

function createSignal(overrides = {}) {
  return {
    id: "101",
    context: {
      symbol: "BTC/USDT",
      timeframe: "5m",
      score: 92,
      strategyId: "trend-alignment",
      direction: "BUY",
      source: "watchlist",
      observedAt: "2026-03-22T10:00:00.000Z",
    },
    feedKinds: ["watchlist"],
    intelligence: {
      executionEligible: true,
    },
    ranking: {
      tier: "high-confidence",
    },
    ...overrides,
  };
}

test("auto bot resolves a clear eligible signal into execute-ready intent", () => {
  const intent = resolveAutomatedIntent(createBot(), createSignal(), []);

  assert.equal(intent.action, "execute");
  assert.equal(intent.status, "pending");
  assert.equal(intent.executionIntentStatus, "ready");
  assert.equal(intent.guardrail?.code, "clear");
});

test("auto bot blocks when risk guardrails already reached max open positions", () => {
  const bot = createBot();
  const signal = createSignal();
  const decisions = [
    {
      id: "decision-1",
      botId: bot.id,
      status: "pending",
      symbol: signal.context.symbol,
      metadata: {},
    },
    {
      id: "decision-2",
      botId: bot.id,
      status: "approved",
      symbol: "ETH/USDT",
      metadata: {},
    },
  ];

  const intent = resolveAutomatedIntent(bot, signal, decisions);

  assert.equal(intent.action, "block");
  assert.equal(intent.status, "blocked");
  assert.equal(intent.executionIntentStatus, "guardrail-blocked");
  assert.equal(intent.guardrail?.code, "max-open-positions");
});

test("guardrails block symbol overlap when execution overlap is blocked", () => {
  const bot = createBot();
  const signal = createSignal();
  const guardrail = evaluateExecutionGuardrails(bot, signal, [
    {
      id: "decision-1",
      botId: bot.id,
      status: "pending",
      symbol: "BTC/USDT",
      metadata: {},
    },
  ]);

  assert.equal(guardrail.status, "blocked");
  assert.equal(guardrail.code, "execution-overlap-blocked");
});

test("contention summary marks a bot as severe when another active peer leads the same paper queue", () => {
  const leaderBot = createBot({ id: "bot-2", name: "Leader Bot" });
  const targetBot = createBot({ id: "bot-1", name: "Follower Bot" });
  const decisions = [
    {
      id: "leader-decision",
      botId: "bot-2",
      createdAt: "2026-03-22T10:00:00.000Z",
      updatedAt: "2026-03-22T10:00:00.000Z",
      metadata: {
        generatedByOperationalLoop: true,
        executionIntentLane: "paper",
        executionIntentLaneStatus: "dispatch-requested",
        executionIntentDispatchRequestedAt: "2026-03-22T10:00:00.000Z",
      },
    },
    {
      id: "target-decision",
      botId: "bot-1",
      createdAt: "2026-03-22T10:01:00.000Z",
      updatedAt: "2026-03-22T10:01:00.000Z",
      metadata: {
        generatedByOperationalLoop: true,
        executionIntentLane: "paper",
        executionIntentLaneStatus: "dispatch-requested",
        executionIntentDispatchRequestedAt: "2026-03-22T10:01:00.000Z",
      },
    },
  ];

  const summary = getBotReadyContentionSummary(targetBot, decisions, [targetBot, leaderBot]);

  assert.equal(summary.isContended, true);
  assert.equal(summary.severe, true);
  assert.equal(summary.queuePosition, 2);
  assert.equal(summary.leaderBotId, "bot-2");
});

test("dispatch signal id prefers metadata ids before signalSnapshotId", () => {
  const decision = {
    metadata: {
      signalId: 42,
      publishedSignalId: 33,
    },
    signalSnapshotId: 12,
  };

  assert.equal(getDispatchSignalId(decision), 42);
});

test("intent lane follows execution environment", () => {
  assert.equal(getIntentLaneForBot(createBot({ executionEnvironment: "paper" })), "paper");
  assert.equal(getIntentLaneForBot(createBot({ executionEnvironment: "demo" })), "demo");
  assert.equal(getIntentLaneForBot(createBot({ executionEnvironment: "real" })), "real");
});
