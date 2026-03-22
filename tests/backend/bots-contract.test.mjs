import test from "node:test";
import assert from "node:assert/strict";

import { __botInternals } from "../../api/_lib/bots.js";

test("bot contract rejects runtime-owned fields from client payloads", () => {
  assert.throws(
    () => __botInternals.sanitizeMutableBotPayload({
      name: "Signal Bot 1",
      performance: { winRate: 99 },
    }, "update"),
    /campos no editables/i,
  );
});

test("bot contract preserves explicit empty arrays for universe and timeframe patches", () => {
  const payload = __botInternals.sanitizeMutableBotPayload({
    universePolicy: {
      kind: "watchlist",
      watchlistIds: [],
      symbols: [],
      filters: {
        preferredTimeframes: [],
      },
    },
    timeframePolicy: {
      preferredTimeframes: [],
      allowedTimeframes: [],
    },
  }, "update");

  assert.deepEqual(payload.universePolicy.watchlistIds, []);
  assert.deepEqual(payload.universePolicy.symbols, []);
  assert.deepEqual(payload.universePolicy.filters.preferredTimeframes, []);
  assert.deepEqual(payload.timeframePolicy.preferredTimeframes, []);
  assert.deepEqual(payload.timeframePolicy.allowedTimeframes, []);
});

test("bot contract merge keeps explicit empty arrays instead of reviving stale scope", () => {
  const merged = __botInternals.mergeUniversePolicy(
    {
      kind: "watchlist",
      watchlistIds: ["swing-core"],
      symbols: ["BTC/USDT", "ETH/USDT"],
      filters: {
        preferredTimeframes: ["15m", "1h"],
      },
    },
    {
      watchlistIds: [],
      symbols: [],
      filters: {
        preferredTimeframes: [],
      },
    },
  );

  assert.deepEqual(merged.watchlistIds, []);
  assert.deepEqual(merged.symbols, []);
  assert.deepEqual(merged.filters.preferredTimeframes, []);
});

test("bot normalization no longer rehydrates default tags when client clears them", () => {
  const normalized = __botInternals.normalizeBotPayload({
    id: "bot-a",
    slug: "bot-a",
    name: "Bot A",
    tags: [],
  });

  assert.deepEqual(normalized.tags, []);
});

test("bot guardrails force auto mode into executable policy flags", () => {
  const bot = __botInternals.applyBotGuardrails(__botInternals.normalizeBotPayload({
    id: "bot-auto",
    slug: "bot-auto",
    name: "Bot Auto",
    automationMode: "auto",
    executionEnvironment: "demo",
    executionPolicy: {
      canOpenPositions: false,
      suggestionsOnly: true,
      requiresHumanApproval: true,
      autoExecutionEnabled: false,
      realExecutionEnabled: true,
    },
    universePolicy: {
      kind: "custom-list",
      symbols: ["btc/usdt"],
      watchlistIds: [],
      filters: {},
    },
    timeframePolicy: {
      preferredTimeframes: ["5m"],
      allowedTimeframes: ["5m"],
    },
    capital: {
      allocatedUsd: 1000,
      availableUsd: 1000,
    },
    riskPolicy: {
      maxPositionUsd: 100,
      maxOpenPositions: 1,
      maxDailyLossPct: 5,
      maxDrawdownPct: 10,
      cooldownAfterLosses: 0,
      maxSymbolExposurePct: 50,
      realExecutionRequiresApproval: true,
    },
  }));

  assert.equal(bot.automationMode, "auto");
  assert.equal(bot.executionPolicy.canOpenPositions, true);
  assert.equal(bot.executionPolicy.suggestionsOnly, false);
  assert.equal(bot.executionPolicy.requiresHumanApproval, false);
  assert.equal(bot.executionPolicy.autoExecutionEnabled, true);
  assert.equal(bot.executionPolicy.realExecutionEnabled, false);
});

test("bot guardrails force observe mode back into non-executable policy flags", () => {
  const bot = __botInternals.applyBotGuardrails(__botInternals.normalizeBotPayload({
    id: "bot-observe",
    slug: "bot-observe",
    name: "Bot Observe",
    automationMode: "observe",
    executionEnvironment: "paper",
    executionPolicy: {
      canOpenPositions: true,
      suggestionsOnly: false,
      requiresHumanApproval: false,
      autoExecutionEnabled: true,
      realExecutionEnabled: true,
    },
    universePolicy: {
      kind: "watchlist",
      symbols: [],
      watchlistIds: [],
      filters: {},
    },
    timeframePolicy: {
      preferredTimeframes: ["1h"],
      allowedTimeframes: ["1h"],
    },
    capital: {
      allocatedUsd: 1000,
      availableUsd: 1000,
    },
    riskPolicy: {
      maxPositionUsd: 100,
      maxOpenPositions: 1,
      maxDailyLossPct: 5,
      maxDrawdownPct: 10,
      cooldownAfterLosses: 0,
      maxSymbolExposurePct: 50,
      realExecutionRequiresApproval: true,
    },
  }));

  assert.equal(bot.automationMode, "observe");
  assert.equal(bot.executionPolicy.canOpenPositions, false);
  assert.equal(bot.executionPolicy.suggestionsOnly, true);
  assert.equal(bot.executionPolicy.requiresHumanApproval, true);
  assert.equal(bot.executionPolicy.autoExecutionEnabled, false);
  assert.equal(bot.executionPolicy.realExecutionEnabled, false);
});

test("stored bot rows rehydrate through guardrails before reaching runtime", () => {
  const bot = __botInternals.rowToBot({
    bot_id: "bot-legacy",
    slug: "bot-legacy",
    name: "Bot Legacy",
    status: "draft",
    created_at: "2026-03-22T00:00:00.000Z",
    updated_at: "2026-03-22T00:00:00.000Z",
    bot_payload: {
      automationMode: "observe",
      executionEnvironment: "demo",
      universePolicy: {
        kind: "watchlist",
        symbols: [],
        watchlistIds: [],
        filters: {},
      },
      timeframePolicy: {
        preferredTimeframes: ["1h"],
        allowedTimeframes: ["1h"],
      },
      capital: {
        allocatedUsd: 1000,
        availableUsd: 1000,
      },
      riskPolicy: {
        maxPositionUsd: 100,
        maxOpenPositions: 1,
        maxDailyLossPct: 5,
        maxDrawdownPct: 10,
        cooldownAfterLosses: 0,
        maxSymbolExposurePct: 50,
        realExecutionRequiresApproval: true,
      },
      executionPolicy: {
        canOpenPositions: true,
        suggestionsOnly: true,
        requiresHumanApproval: true,
        autoExecutionEnabled: false,
        realExecutionEnabled: false,
      },
    },
  });

  assert.equal(bot.executionPolicy.canOpenPositions, false);
  assert.equal(bot.executionPolicy.suggestionsOnly, true);
  assert.equal(bot.executionPolicy.requiresHumanApproval, true);
});

test("stored bot hydration clamps legacy max position instead of throwing", () => {
  const bot = __botInternals.rowToBot({
    bot_id: "bot-legacy-risk",
    slug: "bot-legacy-risk",
    name: "Bot Legacy Risk",
    status: "draft",
    created_at: "2026-03-22T00:00:00.000Z",
    updated_at: "2026-03-22T00:00:00.000Z",
    bot_payload: {
      automationMode: "assist",
      executionEnvironment: "demo",
      universePolicy: {
        kind: "custom-list",
        symbols: [],
        watchlistIds: [],
        filters: {},
      },
      workspaceSettings: {
        primaryPair: "btc/usdt",
      },
      timeframePolicy: {
        preferredTimeframes: ["1h"],
        allowedTimeframes: ["1h"],
      },
      capital: {
        allocatedUsd: 500,
        availableUsd: 500,
      },
      riskPolicy: {
        maxPositionUsd: 1000,
        maxOpenPositions: 1,
        maxDailyLossPct: 5,
        maxDrawdownPct: 10,
        cooldownAfterLosses: 0,
        maxSymbolExposurePct: 50,
        realExecutionRequiresApproval: true,
      },
      executionPolicy: {
        canOpenPositions: true,
        suggestionsOnly: false,
        requiresHumanApproval: true,
        autoExecutionEnabled: false,
        realExecutionEnabled: false,
      },
    },
  });

  assert.equal(bot.workspaceSettings.primaryPair, "BTC/USDT");
  assert.deepEqual(bot.universePolicy.symbols, ["BTC/USDT"]);
  assert.equal(bot.riskPolicy.maxPositionUsd, 500);
});
