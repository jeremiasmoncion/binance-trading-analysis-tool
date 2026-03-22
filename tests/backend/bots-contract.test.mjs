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
