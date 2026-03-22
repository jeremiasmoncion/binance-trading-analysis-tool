import test from "node:test";
import assert from "node:assert/strict";

import {
  computeBotAutomationConsistency,
  computeSignalOrderConsistency,
  orderRequiresExplicitSide,
} from "../../scripts/system-audit.mjs";

test("system audit does not require BUY/SELL side for blocked execution records", () => {
  assert.equal(orderRequiresExplicitSide({
    lifecycle_status: "blocked",
    side: "",
  }), false);
});

test("system audit missingSide only measures trade-relevant execution orders", () => {
  const consistency = computeSignalOrderConsistency(
    [],
    [
      {
        id: 1,
        signal_id: 101,
        lifecycle_status: "blocked",
        side: "",
      },
      {
        id: 2,
        signal_id: 102,
        lifecycle_status: "protected",
        side: "BUY",
      },
      {
        id: 3,
        signal_id: 103,
        lifecycle_status: "closed_loss",
        side: "",
      },
    ],
    [],
  );

  assert.equal(consistency.directionalOrders, 2);
  assert.equal(consistency.missingSidePct, 50);
});

test("system audit flags bots whose automation mode drifted from execution policy", () => {
  const consistency = computeBotAutomationConsistency([
    {
      bot_id: "bot-auto",
      status: "active",
      name: "Bot Auto",
      bot_payload: {
        automationMode: "auto",
        executionEnvironment: "demo",
        executionPolicy: {
          autoExecutionEnabled: false,
          suggestionsOnly: true,
          requiresHumanApproval: true,
          canOpenPositions: false,
          realExecutionEnabled: true,
        },
      },
    },
  ]);

  assert.equal(consistency.totalBots, 1);
  assert.equal(consistency.autoBots, 1);
  assert.equal(consistency.inconsistentBots.length, 1);
  assert.match(consistency.inconsistentBots[0].reasons.join(" | "), /autoExecutionEnabled should be true/i);
  assert.match(consistency.inconsistentBots[0].reasons.join(" | "), /realExecutionEnabled should be false outside real environment/i);
});
