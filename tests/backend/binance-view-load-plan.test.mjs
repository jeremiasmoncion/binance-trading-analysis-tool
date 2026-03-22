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

test("dashboard refreshes the live summary on first authenticated load even with stream enabled", () => {
  const loadPlan = buildInitialConnectedLoadPlan("dashboard", true, "live");

  assert.equal(loadPlan.portfolioMode, "live");
  assert.equal(loadPlan.refreshExecution, false);
  assert.equal(loadPlan.refreshDashboard, true);
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

test("returning to dashboard refreshes the live summary immediately", () => {
  const loadPlan = buildConnectedViewLoadPlan("dashboard", "control-bot-settings", true, "live");

  assert.equal(loadPlan.portfolioMode, null);
  assert.equal(loadPlan.refreshExecution, false);
  assert.equal(loadPlan.refreshDashboard, true);
});
