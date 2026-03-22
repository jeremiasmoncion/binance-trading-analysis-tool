import test from "node:test";
import assert from "node:assert/strict";

import {
  viewNeedsBotRuntimeBootstrap,
  viewNeedsSharedSignalMemoryBootstrap,
} from "../../src/data-platform/botWorkspaceBootstrap.ts";

test("bot settings is treated as a bot runtime bootstrap surface", () => {
  assert.equal(viewNeedsBotRuntimeBootstrap("control-bot-settings"), true);
});

test("signal bot is treated as a bot runtime bootstrap surface", () => {
  assert.equal(viewNeedsBotRuntimeBootstrap("ai-signal-bot"), true);
});

test("bot settings participates in shared signal-memory bootstrap", () => {
  assert.equal(viewNeedsSharedSignalMemoryBootstrap("control-bot-settings"), true);
});

test("profile does not participate in bot runtime bootstrap", () => {
  assert.equal(viewNeedsBotRuntimeBootstrap("profile"), false);
  assert.equal(viewNeedsSharedSignalMemoryBootstrap("profile"), false);
});
