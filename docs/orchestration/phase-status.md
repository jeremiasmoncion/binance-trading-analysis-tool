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
  - validate the new template-faithful sidebar and first `Control Panel` / `AI Bot` pages
  - replace the old generic `Signals` / `Bots` destinations with the approved template flow
- `next`
  - deepen fidelity inside `Control Panel -> Overview`
  - deepen fidelity inside `Control Panel -> Bot Settings`
  - deepen fidelity inside `Control Panel -> Execution Logs`
  - deepen fidelity inside `AI Bot -> Signal Bot`
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
