import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConnectedViewLoadPlan,
  buildInitialConnectedLoadPlan,
} from "../../src/data-platform/connectedLoadPlan.ts";

test("bot settings warms execution center on first authenticated load", () => {
  const loadPlan = buildInitialConnectedLoadPlan("control-bot-settings", false, "full");

  assert.equal(loadPlan.portfolioMode, null);
  assert.equal(loadPlan.refreshExecution, true);
  assert.equal(loadPlan.refreshDashboard, false);
});

test("signal bot warms execution center on first authenticated load", () => {
  const loadPlan = buildInitialConnectedLoadPlan("ai-signal-bot", false, "full");

  assert.equal(loadPlan.portfolioMode, null);
  assert.equal(loadPlan.refreshExecution, true);
  assert.equal(loadPlan.refreshDashboard, false);
});

test("entering bot settings from another view refreshes execution immediately", () => {
  const loadPlan = buildConnectedViewLoadPlan("control-bot-settings", "dashboard", false, "full");

  assert.equal(loadPlan.portfolioMode, null);
  assert.equal(loadPlan.refreshExecution, true);
  assert.equal(loadPlan.refreshDashboard, false);
});

test("entering execution logs from another view refreshes execution immediately", () => {
  const loadPlan = buildConnectedViewLoadPlan("control-execution-logs", "dashboard", false, "full");

  assert.equal(loadPlan.portfolioMode, null);
  assert.equal(loadPlan.refreshExecution, true);
  assert.equal(loadPlan.refreshDashboard, false);
});
