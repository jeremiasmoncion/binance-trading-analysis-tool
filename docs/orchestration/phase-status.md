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
  - persistent realtime-core overlay emit dedup is now semantic, so freshness-only timestamps do not republish equivalent overlays
  - hybrid dashboard/runtime refreshes now ignore freshness-only summary metadata, reducing selector churn outside the realtime core too
- `in progress`
  - review integration lot on `codex/level-4-adaptive`
  - validate the new read-only signals+bots lab against the hardened runtime baseline
- `next`
  - deeper explainability tuning and discovery pruning for published signals
  - deeper threshold tuning for `high-confidence`
  - execution-center and shared runtime comparator audit for denser bot/signal payloads
  - deeper UI composition backed by domain selectors if the current lab becomes too dense
  - optional persistence seam for the local bot registry later
  - director review of the next Phase 3 integration boundary after preview feedback

## Rule For Future Updates

After each meaningful round, update:

- what phase is active
- what was completed
- what is currently in progress
- what comes next
