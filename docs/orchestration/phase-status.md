# Phase Status

## Current Phase

- Active phase: `Phase 2 / Phase 3 bridge`
- Objective: domain contracts landed, safe integration seam next

## Current State

- `done`
  - base redesign documentation created under `docs/next-signals-bots-ai/`
  - orchestration documentation initialized
  - explicit bot domain contracts added under `src/domain/`
  - execution environment / automation mode contracts added
  - overlap policy and AI policy contracts added
  - signal feed taxonomy contracts added
  - shared realtime overlay application is now no-op aware, reducing churn before bot runtime expansion
- `in progress`
  - validating threshold behavior and watchlist-vs-market noise split from `signal memory snapshots`
- `next`
  - deeper threshold tuning and ranking defensibility for published signals
  - richer ranking explanation in the temporary lab host
  - deeper UI composition backed by domain selectors if the current lab becomes too dense
  - optional persistence seam for the local bot registry later
  - director review for Phase 3 integration boundary

## Rule For Future Updates

After each meaningful round, update:

- what phase is active
- what was completed
- what is currently in progress
- what comes next
