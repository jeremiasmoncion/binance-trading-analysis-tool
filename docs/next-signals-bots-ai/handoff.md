# Handoff

## Current Status

The project now has a dedicated documentation base for the redesign of CRYPE into a `signals + bots + AI` platform.

This documentation is the source of truth for:

- redesign intent
- current state interpretation
- target architecture
- phased implementation strategy
- working decisions already agreed

The project also now has an orchestration base for multi-thread execution under:

- `docs/orchestration/`

## What Has Been Done

- mapped major current components related to:
  - strategy generation
  - signal persistence
  - execution filtering
  - watchlist scanning
  - adaptive governance
- defined target conceptual architecture
- documented closed product decisions
- established a phased work structure

## What Has Not Been Done Yet

- no new bot domain code has been introduced yet
- no signal feed separation code has been introduced yet
- no new persistence or selectors for bots exist yet
- no AI conversational layer has been implemented yet

## Files Added

- `docs/next-signals-bots-ai/README.md`
- `docs/next-signals-bots-ai/current-state.md`
- `docs/next-signals-bots-ai/target-architecture.md`
- `docs/next-signals-bots-ai/domain-model.md`
- `docs/next-signals-bots-ai/implementation-plan.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/README.md`
- `docs/orchestration/roles.md`
- `docs/orchestration/workflow.md`
- `docs/orchestration/phase-status.md`
- `docs/orchestration/ownership.md`
- `docs/orchestration/task-template.md`

## Recommended Next Implementation Step

Introduce explicit code-level domain contracts for:

- bot
- bot universe policy
- execution environment
- automation mode
- overlap policy
- signal feed taxonomy
- bot memory summary
- bot performance summary

This should be done before trying to “convert” current scanner or execution behavior into bot behavior.

## GitHub Notification Practice

The AI threads cannot send direct phone notifications.

For human visibility, meaningful milestone completion should be exposed through GitHub by:

- making clear commits
- pushing completed milestones
- optionally opening PRs for integration rounds

This makes GitHub the practical notification path to the owner mobile device.

## Important Constraints To Preserve

- do not break shared planes
- do not discard signal memory
- do not discard execution engine
- do not discard adaptive governance logic
- do not allow unrestricted AI mode to break accounting/execution isolation
- do not implement the entire redesign in one step

## Warning For Future Contributors

If you skip the explicit domain model and jump straight into feature work, the redesign is likely to become another layer of hidden coupling on top of the existing pipeline.

Keep the work phased.

## Refinador Runtime - 2026-03-19

### What Was Done

- Hardened the shared realtime event application path in `src/realtime-core/events.ts`.
- Added no-op awareness for `system.overlay.updated` so identical overlay frames do not recreate shared state.
- Reduced heartbeat writes to minimal metadata-only updates when the runtime is already healthy.

### Files Touched

- `src/realtime-core/events.ts`
- `docs/data-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Where This Round Ended

- The frontend side of shared realtime overlay application is now quieter and better prepared for higher-frequency bot/runtime state.
- Emit-side deduplication inside the external realtime core remains pending.

### What Remains Pending

- Decide whether identical overlays should also be filtered before emit in `realtime-core-service/server.mjs`.
- Continue auditing shared hot paths before first-class bot runtime state lands.

### What The Director Should Review

- Whether future bot-event work should keep flowing through the shared `system.overlay.updated` contract or evolve into a more granular taxonomy later.
- The main repo checkout was being switched by another thread, so the refinement round was completed and pushed from a dedicated worktree on `codex/refinador-runtime`.

### What The Implementer Should Avoid

- Do not add screen-level SSE/WebSocket consumers for bot state.
- Do not bypass `selectors + actions` with direct runtime subscriptions in product-layer work.
- Do not reshape `src/realtime-core/events.ts` without coordinating with the director/refinador.

## Refinador Runtime - 2026-03-19 - Semantic Emit Dedup

### What Was Done

- Hardened emit-side overlay deduplication in `realtime-core-service/server.mjs`.
- Added semantic hashing for overlays so volatile freshness metadata (`generatedAt`, `updatedAt`) no longer causes new `system.overlay.updated` events by itself.
- Kept payload timestamps intact for consumers and operators; only the comparison path is normalized.

### Files Touched

- `realtime-core-service/server.mjs`
- `docs/data-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Where This Round Ended

- The external realtime core now deduplicates overlays semantically on both sides:
  - emit side in `realtime-core-service/server.mjs`
  - apply side in `src/realtime-core/events.ts`
- Shared selector-driven surfaces are better protected against churn as bot/runtime state density grows.

### What Remains Pending

- Decide whether future bot/live event growth should stay under the current `system.overlay.updated` contract or split into a more granular event taxonomy.
- Continue auditing shared runtime hooks for no-op writes outside the realtime core.

### What The Director Should Review

- Whether the current overlay contract should remain the canonical event seam for early bot/runtime work.
- Whether the implementador should be explicitly forbidden from publishing bot-state overlays outside the semantic dedup path.

### What The Implementer Should Avoid

- Do not emit new live frames that differ only by timestamps.
- Do not create bot-specific realtime feeds that bypass `realtime-core-service/server.mjs` normalization rules.
- Do not touch `realtime-core-service/server.mjs` without coordinating with direction/refinement because it is now part of the protected hot path.

## Refinador Runtime - 2026-03-19 - Semantic Shared Runtime Refresh

### What Was Done

- Hardened `useBinanceData` so `dashboardSummary` no-op checks ignore freshness-only metadata such as `generatedAt`.
- Upgraded semantic comparison of dashboard `topAssets` and recent execution orders to avoid republishing equivalent summary payloads through hybrid refresh paths.
- Made Binance alias hydration no-op aware so repeated connection refreshes do not rewrite the profile form when the alias string did not change.

### Files Touched

- `src/hooks/useBinanceData.ts`
- `docs/data-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### Where This Round Ended

- Shared dashboard/runtime reads are now quieter outside the realtime core too.
- The most visible remaining hybrid seam is deeper semantic comparison around execution-center growth as future bot-owned operational state lands.

### What Remains Pending

- Continue auditing shared hooks for equivalent writes outside the emit/apply realtime path.
- Revisit `ExecutionCenterPayload` semantic equality if bot state starts expanding candidate/order payload density.

### What The Director Should Review

- Whether direction wants an explicit protected-runtime guideline for summary/read-model comparators, not only for event streams.
- This round stayed inside the refinador mandate and did not touch product-layer features.

### What The Implementer Should Avoid

- Do not rely on `generatedAt` or similar freshness metadata to decide whether a shared summary is “new”.
- Do not introduce bot-facing read models that force selector churn just because a backend response recreated arrays or timestamps.
