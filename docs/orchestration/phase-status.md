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
  - shared execution runtime equality now compares policy arrays, candidate cohorts and recent-order cohorts semantically, reducing churn before template-scale execution surfaces expand
  - first template-facing `Signals` and `Bots` pages now use a narrow shared feed selector instead of the broader memory/runtime selector bundle
  - shared scanner runtime equality now compares target cohorts and run cohorts semantically before denser control-panel surfaces land
- `in progress`
  - validate the first dedicated user-facing `Signals` and `Bots` pages
  - replace the old `Signal Bot` journey with the new page structure over time
- `next`
  - deeper explainability tuning and discovery pruning inside the new `Signals` page
  - deeper threshold tuning for `high-confidence`
  - bot-list-first UX refinement inside the new `Bots` page
  - execution-center and shared runtime comparator audit for denser bot/signal payloads
  - reduce the legacy `Signal Bot` page to technical/admin duty later if still needed
  - optional persistence seam for the local bot registry later
  - director review of the next Phase 3 integration boundary after preview feedback

## Rule For Future Updates

After each meaningful round, update:

- what phase is active
- what was completed
- what is currently in progress
- what comes next
