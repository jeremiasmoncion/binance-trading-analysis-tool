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
- `in progress`
  - validate `Signal Bot` as the first page-specific closure target
  - continue page-by-page closure instead of broad facade-first expansion
- `next`
  - choose the next page after `Signal Bot` and close it with the same discipline
  - continue deepening fidelity inside `Control Panel -> Overview`
  - continue deepening fidelity inside `Control Panel -> Bot Settings`
  - continue deepening fidelity inside `Control Panel -> Execution Logs`
  - decide when the account/marketplace placeholder routes should receive real content
  - decide when transitional legacy views can stop being carried in the repo
  - execution-center and shared runtime comparator audit for denser bot/signal payloads
  - reduce legacy technical pages to admin-only duty later if still needed
  - optional persistence seam for the local bot registry later
  - director review of the next Phase 3 integration boundary after preview feedback

## Rule For Future Updates

After each meaningful round, update:

- what phase is active
- what was completed
- what is currently in progress
- what comes next
