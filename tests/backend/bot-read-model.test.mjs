import test from "node:test";
import assert from "node:assert/strict";

import {
  createDecisionTimeline,
  createExecutionIntentSummary,
  createOwnershipSummary,
  dedupeRankedSignalsByScope,
  getDecisionPublishedSignalKey,
  resolveBotScopeSymbols,
} from "../../src/domain/bots/readModel.ts";
import {
  createBotCardsWithExecutionContext,
  createBotCardsWithOperationalContext,
  createBotFleetSummary,
} from "../../src/domain/bots/workspace.ts";

test("bot read-model resolves watchlist universe without losing explicit symbols", () => {
  const symbols = resolveBotScopeSymbols(
    {
      universePolicy: {
        kind: "watchlist",
        symbols: ["btc/usdt", "eth/usdt"],
      },
      workspaceSettings: {
        primaryPair: "bnb/usdt",
      },
    },
    ["ETH/USDT", "SOL/USDT"],
  );

  assert.deepEqual(symbols, ["ETH/USDT", "SOL/USDT", "BTC/USDT"]);
});

test("bot read-model marks stale preview intents as preview-expired", () => {
  const summary = createExecutionIntentSummary([
    {
      symbol: "BTC/USDT",
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
      metadata: {
        executionIntentStatus: "ready",
        executionIntentLane: "paper",
        executionIntentLaneStatus: "preview-recorded",
      },
    },
  ]);

  assert.equal(summary.previewExpiredCount, 1);
  assert.equal(summary.latestLaneStatus, "preview-expired");
});

test("bot read-model ownership summary ignores blocked and dismissed unresolved decisions", () => {
  const summary = createOwnershipSummary(
    [
      {
        id: "decision-1",
        symbol: "BTC/USDT",
        status: "approved",
        executionOrderId: null,
      },
      {
        id: "decision-2",
        symbol: "ETH/USDT",
        status: "blocked",
        executionOrderId: null,
      },
      {
        id: "decision-3",
        symbol: "SOL/USDT",
        status: "dismissed",
        executionOrderId: null,
      },
    ],
    [],
  );

  assert.equal(summary.unresolvedDecisionCount, 1);
  assert.equal(summary.primaryIssue, "decision-linkage");
  assert.deepEqual(summary.unresolvedDecisionSymbols, ["BTC/USDT"]);
});

test("bot read-model strips bot suffixes from published signal ids", () => {
  const key = getDecisionPublishedSignalKey({
    metadata: {
      publishedSignalId: "123:bot:signal-bot-2",
    },
    signalSnapshotId: null,
  });

  assert.equal(key, "123");
});

test("bot read-model dedupes ranked signals by symbol and timeframe scope", () => {
  const deduped = dedupeRankedSignalsByScope([
    {
      id: "signal-1",
      context: {
        symbol: "btc/usdt",
        timeframe: "5M",
      },
    },
    {
      id: "signal-2",
      context: {
        symbol: "BTC/USDT",
        timeframe: "5m",
      },
    },
    {
      id: "signal-3",
      context: {
        symbol: "ETH/USDT",
        timeframe: "5m",
      },
    },
  ]);

  assert.deepEqual(deduped.map((item) => item.id), ["signal-1", "signal-3"]);
});

test("workspace execution context only counts canonical trades as executed activity", () => {
  const decisions = [
    {
      id: "decision-1",
      botId: "bot-1",
      signalSnapshotId: 101,
      symbol: "BTC/USDT",
      timeframe: "5m",
      signalLayer: "operable",
      action: "execute",
      status: "executed",
      source: "manual",
      rationale: "",
      executionEnvironment: "paper",
      automationMode: "assist",
      marketContextSignature: null,
      contextTags: [],
      metadata: {
        executionOrderId: 1,
        signalId: 101,
        publishedSignalId: "101",
      },
      createdAt: "2026-03-21T10:00:00.000Z",
      updatedAt: "2026-03-21T10:01:00.000Z",
    },
  ];
  const decisionTimeline = createDecisionTimeline(decisions);
  const { botCardsWithExecution } = createBotCardsWithExecutionContext({
    botCards: [
      {
        id: "bot-1",
        slug: "signal-bot-1",
        name: "Signal Bot 1",
        identity: { family: "signals", operatingProfile: "manual-assisted", ownerScope: "user", isTemplate: false, isIsolated: false },
        status: "active",
        executionEnvironment: "paper",
        automationMode: "assist",
        capital: { allocatedUsd: 1000, availableUsd: 1000, accountingScope: "bot" },
        workspaceSettings: { primaryPair: "BTC/USDT" },
        generalSettings: {},
        notificationSettings: {},
        universePolicy: { kind: "custom-list", watchlistIds: [], symbols: ["BTC/USDT"] },
        stylePolicy: { dominantStyle: "scalping", allowedStyles: ["scalping"], multiStyleEnabled: false },
        timeframePolicy: { allowedTimeframes: ["5m"] },
        strategyPolicy: { allowedStrategyIds: [], preferredStrategyIds: [], adaptiveAdjustmentsEnabled: false },
        riskPolicy: { maxPositionUsd: 100, maxOpenPositions: 1, maxDailyLossPct: 5, maxDrawdownPct: 10, cooldownAfterLosses: 0, maxSymbolExposurePct: 50, realExecutionRequiresApproval: true },
        executionPolicy: { canOpenPositions: true, suggestionsOnly: false, requiresHumanApproval: true, autoExecutionEnabled: false, realExecutionEnabled: false },
        aiPolicy: { analystEnabled: true, adjusterEnabled: false, supervisorEnabled: false, unrestrictedModeEnabled: false, requiresConfirmationFor: [], isolationScope: "standard" },
        overlapPolicy: { observationOverlap: "allow", signalOverlap: "allow", executionOverlap: "block", arbitrationMode: "priority", priority: 1, exclusiveUniverse: false },
        memoryPolicy: { familySharingEnabled: false, globalLearningEnabled: false },
        localMemory: { layer: "local", lastUpdatedAt: null, signalCount: 0, decisionCount: 0, outcomeCount: 0, notes: [] },
        familyMemory: { layer: "family", lastUpdatedAt: null, signalCount: 0, decisionCount: 0, outcomeCount: 0, notes: [] },
        globalMemory: { layer: "global", lastUpdatedAt: null, signalCount: 0, decisionCount: 0, outcomeCount: 0, notes: [] },
        performance: { updatedAt: null, closedSignals: 0, winRate: 0, realizedPnlUsd: 0, avgPnlUsd: 0, avgHoldMinutes: null },
        audit: { lastDecisionAt: null, lastExecutionAt: null, lastPolicyChangeAt: null },
        activity: {
          lastSignalConsumedAt: null,
          lastSignalLayer: null,
          lastDecisionAction: null,
          lastDecisionStatus: null,
          lastDecisionSymbol: null,
          lastDecisionSource: null,
          pendingCount: 0,
          approvedCount: 0,
          blockedCount: 0,
          executedCount: 0,
          recentDecisionIds: [],
          recentSymbols: [],
        },
        tags: [],
        priority: 1,
        createdAt: "2026-03-21T09:00:00.000Z",
        updatedAt: "2026-03-21T09:00:00.000Z",
        decisions,
        decisionTimeline,
        performanceBreakdowns: [],
      },
    ],
    recentOrders: [
      {
        id: 1,
        signal_id: 101,
        coin: "BTC/USDT",
        timeframe: "5m",
        mode: "execute",
        lifecycle_status: "protected",
        side: "BUY",
        current_price: 74200,
        realized_pnl: 0,
        created_at: "2026-03-21T10:01:00.000Z",
        last_synced_at: "2026-03-21T10:02:00.000Z",
        response_payload: { learning_snapshot: { decisionSource: "manual" } },
      },
      {
        id: 2,
        signal_id: 102,
        coin: "ETH/USDT",
        timeframe: "5m",
        mode: "execute",
        lifecycle_status: "blocked",
        side: "SELL",
        created_at: "2026-03-21T10:01:00.000Z",
        last_synced_at: "2026-03-21T10:02:00.000Z",
      },
    ],
    signalMemory: [
      {
        id: 101,
        coin: "BTC/USDT",
        timeframe: "5m",
        execution_order_id: 1,
        entry_price: 74200,
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-21T10:02:00.000Z",
        signal_payload: { context: { direction: "buy" } },
      },
    ],
  });

  assert.equal(botCardsWithExecution[0].tradeTimeline.length, 1);
  assert.equal(botCardsWithExecution[0].activity.executedCount, 1);
  assert.equal(botCardsWithExecution[0].executionBreakdowns.length, 1);
});

test("workspace operational context keeps shared memory disabled when policy says so", () => {
  const { botCardsWithOperationalContention } = createBotCardsWithOperationalContext([
    {
      id: "bot-1",
      slug: "signal-bot-1",
      name: "Signal Bot 1",
      identity: { family: "signals", operatingProfile: "manual-assisted", ownerScope: "user", isTemplate: false, isIsolated: false },
      status: "active",
      executionEnvironment: "paper",
      automationMode: "assist",
      capital: { allocatedUsd: 1000, availableUsd: 1000, accountingScope: "bot" },
      workspaceSettings: { primaryPair: "BTC/USDT" },
      generalSettings: {},
      notificationSettings: {},
      universePolicy: { kind: "custom-list", watchlistIds: [], symbols: ["BTC/USDT"] },
      stylePolicy: { dominantStyle: "scalping", allowedStyles: ["scalping"], multiStyleEnabled: false },
      timeframePolicy: { allowedTimeframes: ["5m"] },
      strategyPolicy: { allowedStrategyIds: [], preferredStrategyIds: [], adaptiveAdjustmentsEnabled: false },
      riskPolicy: { maxPositionUsd: 100, maxOpenPositions: 1, maxDailyLossPct: 5, maxDrawdownPct: 10, cooldownAfterLosses: 0, maxSymbolExposurePct: 50, realExecutionRequiresApproval: true },
      executionPolicy: { canOpenPositions: true, suggestionsOnly: false, requiresHumanApproval: true, autoExecutionEnabled: false, realExecutionEnabled: false },
      aiPolicy: { analystEnabled: true, adjusterEnabled: false, supervisorEnabled: false, unrestrictedModeEnabled: false, requiresConfirmationFor: [], isolationScope: "standard" },
      overlapPolicy: { observationOverlap: "allow", signalOverlap: "allow", executionOverlap: "block", arbitrationMode: "priority", priority: 1, exclusiveUniverse: false },
      memoryPolicy: { familySharingEnabled: false, globalLearningEnabled: false },
      localMemory: { layer: "local", lastUpdatedAt: null, signalCount: 0, decisionCount: 0, outcomeCount: 0, notes: [] },
      familyMemory: { layer: "family", lastUpdatedAt: null, signalCount: 0, decisionCount: 0, outcomeCount: 0, notes: [] },
      globalMemory: { layer: "global", lastUpdatedAt: null, signalCount: 0, decisionCount: 0, outcomeCount: 0, notes: [] },
      performance: { updatedAt: null, closedSignals: 0, winRate: 0, realizedPnlUsd: 0, avgPnlUsd: 0, avgHoldMinutes: null },
      audit: { lastDecisionAt: null, lastExecutionAt: null, lastPolicyChangeAt: null },
      activity: {
        lastSignalConsumedAt: null,
        lastSignalLayer: null,
        lastDecisionAction: null,
        lastDecisionStatus: null,
        lastDecisionSymbol: null,
        lastDecisionSource: null,
        pendingCount: 0,
        approvedCount: 0,
        blockedCount: 0,
        executedCount: 0,
        recentDecisionIds: [],
        recentSymbols: [],
      },
      tags: [],
      priority: 1,
      createdAt: "2026-03-21T09:00:00.000Z",
      updatedAt: "2026-03-21T09:00:00.000Z",
      decisions: [],
      decisionTimeline: [],
      performanceBreakdowns: [],
      executionOrders: [],
      executionTimeline: [],
      tradeTimeline: [],
      executionBreakdowns: [],
      ownership: createOwnershipSummary([], []),
      executionIntentSummary: createExecutionIntentSummary([]),
    },
  ]);

  assert.match(botCardsWithOperationalContention[0].familyMemory.notes[0], /disabled/i);
  assert.match(botCardsWithOperationalContention[0].globalMemory.notes[0], /disabled/i);
});

test("workspace fleet summary aggregates status and attention from bot cards", () => {
  const summary = createBotFleetSummary({
    botCards: [
      {
        id: "bot-1",
        status: "active",
        localMemory: { outcomeCount: 2 },
        performance: { realizedPnlUsd: 15, winRate: 60 },
        ownership: { unresolvedDecisionCount: 1, unlinkedExecutionCount: 0, ownedOutcomeCount: 2, healthLabel: "healthy" },
        adaptationSummary: { trainingConfidence: "high" },
        attention: { score: 55 },
      },
      {
        id: "bot-2",
        status: "draft",
        localMemory: { outcomeCount: 1 },
        performance: { realizedPnlUsd: -3, winRate: 20 },
        ownership: { unresolvedDecisionCount: 0, unlinkedExecutionCount: 1, ownedOutcomeCount: 1, healthLabel: "watch" },
        adaptationSummary: { trainingConfidence: "low" },
        attention: { score: 0 },
      },
    ],
    readyContention: { contendedReadySymbols: 1, contendedReadyBots: 2 },
    fleetOperationalReadiness: { operationalReadyBots: 1, recoveryBots: 0, finalReviewBots: 0 },
    fleetQueueChurn: { queueChurnBots: 0, unstableQueueBots: 0, queueAutoPromotions: 0 },
    fleetSafeLaneStability: { state: "stable", stabilityPct: 50, stableReadyBots: 1 },
    fleetOperationalVerdict: { state: "close", note: "ok" },
    governedDemoGate: { state: "open", note: "ok" },
    paperDemoOperationalStatus: { state: "operational", note: "ok", operationalBots: 1, coveragePct: 50 },
    botsOperationalNow: { state: "yes", note: "ok" },
  });

  assert.equal(summary.botSummary.totalBots, 2);
  assert.equal(summary.botSummary.activeBots, 1);
  assert.equal(summary.botSummary.draftBots, 1);
  assert.equal(summary.botSummary.totalTrades, 3);
  assert.equal(summary.attentionBots.length, 1);
  assert.deepEqual(summary.attentionBots.map((bot) => bot.id), ["bot-1"]);
});
