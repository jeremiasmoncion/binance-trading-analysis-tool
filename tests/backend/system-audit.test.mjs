import test from "node:test";
import assert from "node:assert/strict";

import {
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
