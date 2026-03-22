import test from "node:test";
import assert from "node:assert/strict";

import { buildWorkspaceEntryHydrationPlan } from "../../src/data-platform/workspaceHydration.ts";

test("dashboard blocks first entry and refreshes connected data", () => {
  const plan = buildWorkspaceEntryHydrationPlan("dashboard");

  assert.equal(plan.blockOnFirstEntry, true);
  assert.equal(plan.refreshConnectedData, true);
  assert.equal(plan.refreshSignals, true);
  assert.equal(plan.refreshBotRuntime, false);
});

test("bot settings blocks first entry and warms bot runtime", () => {
  const plan = buildWorkspaceEntryHydrationPlan("control-bot-settings");

  assert.equal(plan.blockOnFirstEntry, true);
  assert.equal(plan.refreshConnectedData, true);
  assert.equal(plan.refreshSignals, true);
  assert.equal(plan.refreshBotRuntime, true);
});

test("signal bot blocks first entry and warms the full bot workspace", () => {
  const plan = buildWorkspaceEntryHydrationPlan("ai-signal-bot");

  assert.equal(plan.blockOnFirstEntry, true);
  assert.equal(plan.refreshConnectedData, true);
  assert.equal(plan.refreshSignals, true);
  assert.equal(plan.refreshBotRuntime, true);
});
