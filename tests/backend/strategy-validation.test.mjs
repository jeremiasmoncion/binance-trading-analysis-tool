import test from "node:test";
import assert from "node:assert/strict";

import { __strategyValidationInternals } from "../../api/_lib/strategyEngine.js";

test("stored validation reports keep a consistent shape even when detail arrays are missing", () => {
  const report = __strategyValidationInternals.buildValidationReportFromStoredRun({
    created_at: "2026-03-21T00:00:00.000Z",
    maturity_score: 77,
    warned_invariants: 2,
    report_payload: {
      summary: {
        maturityScore: 77,
        warnedInvariants: 2,
        activeScorer: "adaptive-v1",
      },
    },
  });

  assert.equal(report.summary.maturityScore, 77);
  assert.equal(report.summary.warnedInvariants, 2);
  assert.deepEqual(report.invariants, []);
  assert.deepEqual(report.scorerTable, []);
  assert.deepEqual(report.replayWindows, []);
});

test("validation lab marks stored reports with summary counts but no detail as needing regeneration", () => {
  const staleStoredReport = {
    summary: {
      passedInvariants: 3,
      warnedInvariants: 2,
      failedInvariants: 0,
    },
    invariants: [],
    scorerTable: [],
    replayWindows: [],
    scenarios: [],
    modelWindowGovernanceHistory: [],
  };

  assert.equal(__strategyValidationInternals.shouldRegenerateValidationReport(staleStoredReport), true);
});

test("validation lab accepts stored reports that already contain detailed invariants", () => {
  const completeStoredReport = {
    summary: {
      passedInvariants: 3,
      warnedInvariants: 1,
      failedInvariants: 0,
    },
    invariants: [{ id: "coverage", status: "warn" }],
    scorerTable: [],
    replayWindows: [],
    scenarios: [],
    modelWindowGovernanceHistory: [],
  };

  assert.equal(__strategyValidationInternals.shouldRegenerateValidationReport(completeStoredReport), false);
});

test("execution-learning coverage only counts closed signals that are execution-tracked", () => {
  const invariants = __strategyValidationInternals.buildValidationInvariants({
    executionProfile: {},
    decisionState: {},
    featureSnapshots: [],
    signals: [
      {
        outcome_status: "win",
        execution_order_id: null,
        execution_status: null,
        signal_payload: {},
      },
      {
        outcome_status: "loss",
        execution_order_id: 501,
        execution_status: "closed_loss",
        signal_payload: {
          executionLearning: {
            lifecycleStatus: "closed_loss",
          },
        },
      },
    ],
  });

  const learningInvariant = invariants.find((item) => item.key === "execution-learning-coverage");
  assert.equal(learningInvariant?.status, "pass");
  assert.match(String(learningInvariant?.detail || ""), /1\/1 señales cerradas con ejecución enlazada/);
});

test("execution-tracked helper ignores closed signals without real execution context", () => {
  assert.equal(__strategyValidationInternals.hasTrackedExecutionContext({
    execution_order_id: null,
    execution_status: "blocked",
    signal_payload: {},
  }), false);

  assert.equal(__strategyValidationInternals.hasTrackedExecutionContext({
    execution_order_id: 812,
    execution_status: null,
    signal_payload: {},
  }), true);
});

test("model config upsert rows always include one active scorer config", () => {
  const rows = __strategyValidationInternals.buildModelConfigUpsertRows(
    [
      {
        label: "model-v2",
        mode: "learned",
        windowType: "global",
        ready: true,
        sampleSize: 120,
        confidence: 78,
        avgPnl: 0.22,
        winRate: 56,
        rrWeight: 3.8,
        adaptiveScoreWeight: 0.04,
        durationPenaltyWeight: 0.2,
        reading: "learned",
      },
    ],
    "adaptive-v1",
    {
      activeScorer: "adaptive-v1",
      source: "validation-bootstrap",
      confidence: 61,
    },
    [],
  );

  const activeRows = rows.filter((item) => item.active);
  assert.equal(activeRows.length, 1);
  assert.equal(activeRows[0].label, "adaptive-v1");
  assert.equal(activeRows[0].status, "active");
});

test("model config upsert rows seed an active scorer config even without training runs", () => {
  const rows = __strategyValidationInternals.buildModelConfigUpsertRows(
    [],
    "adaptive-v1",
    {
      activeScorer: "adaptive-v1",
      source: "validation-bootstrap",
    },
    [],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "adaptive-v1");
  assert.equal(rows[0].active, true);
  assert.equal(rows[0].status, "active");
});

test("model config upsert rows add the missing active scorer beside inactive existing configs", () => {
  const rows = __strategyValidationInternals.buildModelConfigUpsertRows(
    [],
    "adaptive-v1",
    {
      activeScorer: "adaptive-v1",
      source: "validation-bootstrap",
    },
    [
      { label: "model-v2", active: false, ready: true },
      { label: "model-v3", active: false, ready: true },
      { label: "model-v4", active: false, ready: true },
    ],
  );

  const labels = rows.map((item) => item.label).sort();
  const activeRows = rows.filter((item) => item.active);
  assert.deepEqual(labels, ["adaptive-v1", "model-v2", "model-v3", "model-v4"]);
  assert.equal(activeRows.length, 1);
  assert.equal(activeRows[0].label, "adaptive-v1");
});

test("validation invariants accept a single persisted active config aligned with scorerPolicy", () => {
  const invariants = __strategyValidationInternals.buildValidationInvariants({
    executionProfile: {
      scorerPolicy: {
        activeScorer: "adaptive-v1",
      },
    },
    decisionState: {
      modelConfigRegistry: [
        {
          label: "adaptive-v1",
          active: true,
        },
      ],
    },
    featureSnapshots: [],
    signals: [],
  });

  const configInvariant = invariants.find((item) => item.key === "single-active-model-config");
  const alignmentInvariant = invariants.find((item) => item.key === "scorer-policy-aligned");
  assert.equal(configInvariant?.status, "pass");
  assert.equal(alignmentInvariant?.status, "pass");
});
