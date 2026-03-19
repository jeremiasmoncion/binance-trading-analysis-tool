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
- verified the new domain layer with `npm run typecheck`

## What Has Not Been Done Yet

- no persistence or shared store has been attached to the new bot registry yet
- no UI surface consumes the new domain module yet
- no signal feed has been wired into the existing market/runtime pipeline yet
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
- `src/domain/index.ts`

## Recommended Next Implementation Step

Bridge the new contracts into a safe read-only Phase 3 seam:

- the first registry/store location is now established in `src/domain/bots/registry.ts`
- next expose selectors or adapters that let the UI read:
  - bot registry entries
  - published signal feeds
  - bot-consumable signal feeds
- decide with the director whether the first integration point should start from:
  - frontend execution candidates
  - backend execution candidates
  - signal memory snapshots

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
- The new work stayed isolated under `src/domain/` and documentation files.

## Director Review Needed

- confirm whether the next priority should be:
  - read-only UI composition using domain selectors
  - registry persistence seam
  - feed ranking/prioritization
- confirm the first hydration boundary for feeds:
  - frontend execution candidates
  - signal memory snapshots
  - backend payload adapters

## Refiner Coordination Needed

- align before any future hydration from runtime, realtime, signal memory, or execution eligibility flows
- review any future overlap between bot summaries and adaptive governance snapshots

## Warning For Future Contributors

If you skip the explicit domain model and jump straight into feature work, the redesign is likely to become another layer of hidden coupling on top of the existing pipeline.

Keep the work phased.
