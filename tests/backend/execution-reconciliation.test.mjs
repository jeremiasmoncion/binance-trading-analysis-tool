import test from "node:test";
import assert from "node:assert/strict";

import { __executionEngineInternals } from "../../api/_lib/executionEngine.js";
import { listSignalSnapshotsByIdsForUser } from "../../api/_lib/signals.js";

test("signal lookup by ids fetches in chunks and preserves the requested order", async () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const requestUrls = [];

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  global.fetch = async (url) => {
    requestUrls.push(String(url));
    const parsed = new URL(String(url));
    const idsFilter = parsed.searchParams.get("id") || "";
    const ids = idsFilter
      .replace(/^in\.\(/, "")
      .replace(/\)$/, "")
      .split(",")
      .map((value) => Number(value || 0))
      .filter(Boolean);

    const payload = ids
      .slice()
      .reverse()
      .map((id) => ({ id, coin: `COIN-${id}` }));

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const rows = await listSignalSnapshotsByIdsForUser("jeremias", [3, 1, 2], { chunkSize: 2 });
    assert.equal(requestUrls.length, 2);
    assert.deepEqual(rows.map((row) => Number(row.id)), [3, 1, 2]);
  } finally {
    global.fetch = originalFetch;
    if (originalUrl == null) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test("execution reconciliation detects signal ids missing from the in-memory window", () => {
  const signalMap = new Map([[101, { id: 101 }]]);
  const missing = __executionEngineInternals.collectMissingSignalIds(signalMap, [
    { signal_id: 101 },
    { signal_id: 202 },
    { signal_id: 202 },
    { signal_id: 0 },
  ]);

  assert.deepEqual(missing, [202]);
});

test("execution reconciliation infers BUY or SELL from linked signal context when the order side is missing", () => {
  const buySide = __executionEngineInternals.deriveExecutionSide(
    {
      side: "",
      response_payload: {},
    },
    {
      signal_label: "Comprar",
      signal_payload: {
        context: {
          direction: "BUY",
        },
      },
    },
  );

  const sellSide = __executionEngineInternals.deriveExecutionSide(
    {
      side: "",
      response_payload: {
        order: {
          side: "SELL",
        },
      },
    },
    {
      signal_label: "Comprar",
      signal_payload: {},
    },
  );

  assert.equal(buySide, "BUY");
  assert.equal(sellSide, "SELL");
});

test("execution reconciliation persists execution learning when the signal is missing it", () => {
  const shouldPersist = __executionEngineInternals.shouldPersistSignalExecutionLearning(
    {
      id: 101,
      execution_order_id: null,
      execution_status: null,
      execution_mode: null,
      signal_payload: {},
    },
    {
      lifecycleStatus: "protected",
      protectionStatus: "active",
      orderSide: "BUY",
      mode: "execute",
      realizedPnl: 0,
    },
    {
      executionOrderId: 5001,
      executionStatus: "protected",
      executionMode: "execute",
    },
  );

  assert.equal(shouldPersist, true);
});

test("execution reconciliation skips execution learning writes when the persisted snapshot already matches", () => {
  const shouldPersist = __executionEngineInternals.shouldPersistSignalExecutionLearning(
    {
      id: 101,
      execution_order_id: 5001,
      execution_status: "protected",
      execution_mode: "execute",
      signal_payload: {
        executionLearning: {
          lifecycleStatus: "protected",
          protectionStatus: "active",
          orderSide: "BUY",
          mode: "execute",
          realizedPnl: 0,
        },
      },
    },
    {
      lifecycleStatus: "protected",
      protectionStatus: "active",
      orderSide: "BUY",
      mode: "execute",
      realizedPnl: 0,
    },
    {
      executionOrderId: 5001,
      executionStatus: "protected",
      executionMode: "execute",
    },
  );

  assert.equal(shouldPersist, false);
});
