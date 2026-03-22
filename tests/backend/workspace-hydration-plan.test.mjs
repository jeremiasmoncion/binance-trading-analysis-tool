import test from "node:test";
import assert from "node:assert/strict";

import { buildWorkspaceEntryHydrationPlan } from "../../src/data-platform/workspaceHydration.ts";

test("dashboard refreshes connected data without blocking first entry", () => {
  const plan = buildWorkspaceEntryHydrationPlan("dashboard");

  assert.equal(plan.blockOnFirstEntry, false);
  assert.equal(plan.refreshConnectedData, true);
  assert.equal(plan.refreshSignals, true);
  assert.equal(plan.refreshBotRuntime, false);
});

test("bot settings warms bot runtime without blocking first entry", () => {
  const plan = buildWorkspaceEntryHydrationPlan("control-bot-settings");

  assert.equal(plan.blockOnFirstEntry, false);
  assert.equal(plan.refreshConnectedData, true);
  assert.equal(plan.refreshSignals, true);
  assert.equal(plan.refreshBotRuntime, true);
});

test("signal bot warms the full bot workspace without blocking first entry", () => {
  const plan = buildWorkspaceEntryHydrationPlan("ai-signal-bot");

  assert.equal(plan.blockOnFirstEntry, false);
  assert.equal(plan.refreshConnectedData, true);
  assert.equal(plan.refreshSignals, true);
  assert.equal(plan.refreshBotRuntime, true);
});
