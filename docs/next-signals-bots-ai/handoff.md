# Handoff

## Current Status

The project now has a dedicated documentation base for the redesign of CRYPE into a `signals + bots + AI` platform.

The first code-level Phase 2 foundation now exists in an isolated domain module under `src/domain/`.

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
- introduced code-level contracts for:
  - bot entity
  - universe policy
  - execution environment
  - automation mode
  - overlap policy
  - AI policy
  - memory summary
  - performance summary
- introduced signal taxonomy contracts for:
  - `system-signal`
  - `published-signal`
  - `bot-consumable-signal`
  - `execution-candidate`
- added pure adapters to bridge future integration from existing `ExecutionCandidate` and `ExecutionOrderRecord` data
- added initial registry scaffolding with a standard bot and an isolated unrestricted AI bot definition
- added a local domain-owned registry seam for bots with store primitives and read selectors
- added the first adapter boundary for:
  - execution candidates -> published feeds
  - published feeds -> bot-consumable feeds
- clarified that `AI Unrestricted Lab` is a supported isolated example/profile, not a global default policy for all bots
- added a second adapter boundary for:
  - `signal memory snapshots` -> `published signal feed`
  - `published signal feed` + bot policy -> `bot-consumable feed`
- added a first read-only UI validation surface hosted inside `MemoryView`
- added an explicit ranking/prioritization layer over the published feed
- added visible ranking explanations for:
  - promotions
  - degradations
  - high-confidence subset membership
- tightened ranking thresholds and split ranked signals into:
  - `watchlist-first`
  - `market-discovery`
- made market discovery intentionally stricter to reduce feed noise before future product expansion
- moved the read-only lab one step closer to the intended future UX pattern with:
  - stronger header hierarchy
  - denser quick stats
  - clearer feed segmentation
- added human-readable `raw vs ranked` explainability directly on ranked signals
- added more aggressive pruning for weak `market-discovery` combinations
- grouped the lab more explicitly into product-like blocks:
  - overview
  - watchlist-first
  - market discovery
  - high-confidence
  - bot-consumable
- verified the new domain layer with `npm run typecheck`

## What Has Not Been Done Yet

- no persistence or shared store has been attached to the new bot registry yet
- no persistence has been attached to the new bot registry yet
- no global shell wiring has been added for the domain module
- no signal feed has been wired into the existing market/runtime pipeline beyond a read-only host in `MemoryView`
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
- `src/domain/bots/contracts.ts`
- `src/domain/bots/defaults.ts`
- `src/domain/bots/adapters.ts`
- `src/domain/bots/registry.ts`
- `src/domain/bots/selectors.ts`
- `src/domain/signals/contracts.ts`
- `src/domain/signals/classification.ts`
- `src/domain/signals/feedAdapters.ts`
- `src/domain/signals/memoryAdapters.ts`
- `src/domain/signals/ranking.ts`
- `src/domain/signals/selectors.ts`
- `src/domain/index.ts`
- `src/components/domain/SignalsBotsReadOnlyLab.tsx`

## Recommended Next Implementation Step

Bridge the new contracts into a safe read-only Phase 3 seam:

- the first registry/store location is now established in `src/domain/bots/registry.ts`
- a first read-only UI host now exists in `MemoryView`
- feed ranking/prioritization is now in place as a read-only layer over published feed
- current hydration source is intentionally:
  - `signal memory snapshots`
- current validated read path is:
  - `signal memory snapshots`
  - -> `published signal feed`
  - -> `ranked published feed`
  - -> `bot-consumable feed`
  - -> read-only UI
- next step should stay focused on threshold tuning, watchlist-vs-market noise split, and explainability before registry persistence
- next step should likely continue on explainability language and discovery pruning before any persistence work

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

## Runtime Refinement Note

The shared realtime event path was further hardened so identical operational overlays do not recreate the `system plane`.

Files touched in this round:

- `src/realtime-core/events.ts`
- `docs/data-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`

Why this matters:

- the future `signals + bots + AI` system will increase overlay frequency
- duplicated live frames would otherwise scale rerender pressure across dashboard, runtime selectors, and bot-facing surfaces
- this is a core stability refinement, not a product-layer feature

What remains pending:

- keep auditing whether deduplication should also happen before emit inside the external realtime core
- continue checking hot shared paths before adding first-class bot runtime state

What the director should review:

- whether future bot/live event work should be forced through the existing `system.overlay.updated` contract or split into a more granular event taxonomy later

What implementers should avoid:

- do not add new parallel live channels for bot state directly into screens
- do not bypass `selectors + actions` with ad-hoc SSE/WebSocket consumers in feature work
- do not move the new domain contracts into `src/types.ts` until the director chooses the integration strategy

## Sensitive Areas Touched

- None in this round.
- The new work stayed isolated under `src/domain/`, a read-only UI host in `MemoryView`, and documentation files.

## Director Review Needed

- confirm whether the next priority should be:
  - stronger threshold defensibility for `high-confidence`
  - better separation between watchlist-first and market discovery
  - richer ranking explanation before opening a dedicated surface
  - whether the temporary lab is allowed one more refinement round before extraction
- review whether `MemoryView` is the right temporary inspection host until a dedicated signals/bots workspace surface is approved

## Warning For Director

- The branch `codex/implementador-bots-signals` currently includes a prior realtime refinement commit (`390d0aa`) outside the intended implementer scope.
- This round did not extend that cross-scope work, but the integration review should account for it.
- Clean publication for the read-only lab round is being done from a separate branch derived from `origin/codex/implementador-bots-signals`, so the published implementer lot stays free of those realtime commits.

## Refiner Coordination Needed

- align before any future hydration from runtime, realtime, signal memory, or execution eligibility flows
- review any future overlap between bot summaries and adaptive governance snapshots

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
