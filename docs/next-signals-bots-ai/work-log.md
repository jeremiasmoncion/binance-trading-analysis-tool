# Work Log

## 2026-03-19

### Phase

Phase 1 - Discovery and documentation initialization

### Completed

- Reviewed the current project structure with focus on signals, strategy logic, execution, scanner, and adaptive governance.
- Reconstructed the current signal/bot pipeline from code and docs.
- Confirmed product direction toward a dual `signals + bots + AI` platform.
- Captured settled product decisions:
  - dual platform model
  - explicit bot domain
  - watchlist + market-wide signals
  - watchlist or custom-list universes
  - execution environment separated from automation mode
  - unrestricted AI bot with technical/accounting isolation
- Created initial documentation set under `docs/next-signals-bots-ai/`.
- Added orchestration documentation under `docs/orchestration/` for a director thread plus implementation threads workflow.
- Established GitHub as the practical human notification channel for meaningful milestone completion.

### Decisions Captured

- `paper/demo/real` is an execution environment dimension.
- `observe/assist/auto` is an automation mode dimension.
- Bots may observe and signal the same coin, but execution overlap should be policy-governed by default.
- A future conversational assistant should operate via structured actions, not direct uncontrolled mutation.

### Pending

- Define explicit bot domain contracts in code.
- Decide first concrete storage/state location for bot entities.
- Decide initial implementation boundaries for signal feed separation.

### Recommended Next Step

Start Phase 2:

- introduce explicit domain contracts/types for bots, policies, feeds, and overlap
- keep implementation incremental and non-destructive
- if multi-thread execution starts, assign bounded ownership before parallel coding begins

## 2026-03-19 - Runtime Refinement Round

### Area

Shared realtime runtime / `system plane`

### Completed

- Made `applyRealtimeCoreEvent` no-op aware for `system.overlay.updated`.
- Stopped identical overlay frames from recreating `connection`, `execution`, and `dashboardSummary` state when the effective payload is unchanged.
- Narrowed heartbeat writes so routine stream liveness updates only touch the minimal metadata needed.
- Documented the rule in the main architecture docs.

### Why This Matters For Signals + Bots + AI

- Future bot expansion will increase the frequency and density of operational overlays.
- If equivalent realtime frames keep rewriting the `system plane`, selector-driven views will churn more as bot count grows.
- This refinement protects the shared runtime before the project starts introducing bot-owned live state and richer signal feeds.

### Pending

- Continue auditing shared runtime paths for payload equality and fanout.
- Confirm whether the external realtime core should also deduplicate identical overlays before emitting them, not only when applying them in the frontend.

### Recommendation To Director

- Keep implementers away from shared realtime event plumbing unless a change is explicitly coordinated.
- Prefer new bot/runtime work that plugs into shared selectors/actions rather than introducing another live event surface in parallel.

### Phase

Phase 2 - Domain model foundation

### Completed

- Added a new isolated domain surface under `src/domain/` to avoid reshaping the reserved core files during the first implementation round.
- Introduced explicit bot contracts for:
  - bot identity and lifecycle
  - execution environment
  - automation mode
  - universe policy
  - style, timeframe and strategy policy
  - risk, execution, overlap and AI policy
  - memory summary
  - performance summary
- Added default bot scaffolding with:
  - a standard `Signal Bot Core`
  - an isolated `AI Unrestricted Lab`
- Added signal taxonomy contracts separating:
  - `system-signal`
  - `published-signal`
  - `bot-consumable-signal`
  - `execution-candidate`
- Added pure classification/adaptation helpers so future integration can reuse current `ExecutionCandidate` and `ExecutionOrderRecord` outputs without changing the hot path yet.
- Verified the new domain layer with `npm run typecheck`.

### Files Added

- `src/domain/bots/contracts.ts`
- `src/domain/bots/defaults.ts`
- `src/domain/bots/adapters.ts`
- `src/domain/signals/contracts.ts`
- `src/domain/signals/classification.ts`
- `src/domain/index.ts`

### Sensitive Areas Avoided

- Did not touch:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/hooks/useMarketData.ts`
  - `src/hooks/useBinanceData.ts`
  - `src/hooks/useSignalMemory.ts`
  - `src/hooks/useMemoryRuntime.ts`
  - `src/hooks/useValidationLabRuntime.ts`
  - `src/hooks/useWatchlist.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - `realtime-core-service/server.mjs`
  - `api/_lib/executionEngine.js`
  - `api/_lib/strategyEngine.js`
  - `api/_lib/signals.js`
  - `api/_lib/watchlistScanner.js`

### Pending

- Decide with the director where the first bot registry should live during Phase 3:
  - shared plane
  - isolated store
  - persistence-backed adapter
- Decide the first integration seam from current execution outputs into:
  - published signals
  - bot-consumable signals
  - bot summaries
- Coordinate with the refiner before any future work that touches runtime hydration, signal memory, or execution eligibility.

### Recommended Next Step

Move into the Phase 2 / Phase 3 bridge:

- wire the new bot registry scaffold into a non-invasive store or selector layer
- expose first read-only bot and signal feed selectors to the existing UI shell
- keep execution and realtime orchestration untouched until the director approves the integration seam

## 2026-03-19 - Domain Registry Seam Round

### Phase

Phase 2 / Phase 3 bridge

### Completed

- Consolidated `src/domain/` as the official landing zone for the redesign during this phase.
- Added a local `bot registry/store seam` inside the new domain layer instead of wiring bot state into shared runtime or app wiring.
- Added registry primitives in `src/domain/bots/registry.ts`:
  - `createBotRegistryStore`
  - `cloneBotRegistryState`
  - `createBotRegistrySnapshot`
- Added minimal read selectors in `src/domain/bots/selectors.ts` for:
  - all bots
  - selected bot
  - bot by id
  - bots by status
  - bots by style
  - execution-ready bots
  - isolated bots
- Added first signal feed adapter boundary in `src/domain/signals/feedAdapters.ts`:
  - execution candidates -> published feed
  - published signals -> bot-consumable feed
- Adjusted the unrestricted AI bot wording so it is documented as a supported isolated example/profile, not a global default policy for all bots.
- Re-exported the new registry/selectors/feed adapter surface through `src/domain/index.ts`.
- Verified the seam with `npm run typecheck`.

### Exact Domain Structure

- `src/domain/bots/contracts.ts`
- `src/domain/bots/defaults.ts`
- `src/domain/bots/adapters.ts`
- `src/domain/bots/registry.ts`
- `src/domain/bots/selectors.ts`
- `src/domain/signals/contracts.ts`
- `src/domain/signals/classification.ts`
- `src/domain/signals/feedAdapters.ts`
- `src/domain/index.ts`

### Seam Chosen

- The bot registry/store seam now lives entirely in `src/domain/bots/registry.ts`.
- It is local to the new domain layer.
- It is intentionally not connected yet to:
  - `src/App.tsx`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - shared runtime hooks

### Future Integration Path

- UI should later consume this domain through selectors and adapter outputs, not by reading raw runtime state directly.
- Shared architecture should connect later at an adapter boundary where current execution/signal outputs are translated into:
  - published signal feeds
  - bot-consumable feeds
  - bot summaries
- This keeps the first integration read-only and avoids pushing bot state into the hot path before direction approves the exact seam.

### Sensitive Areas Avoided

- Still avoided:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - `api/_lib/*` sensitive runtime files
  - protected hooks

### Pending

- Define whether the next step should be:
  - a read-only UI surface backed by domain selectors
  - a persistence adapter for the registry seam
  - a feed ranking layer above published/bot-consumable feeds
- Decide the first source-of-truth adapter for feed hydration:
  - execution candidates
  - signal memory snapshots
  - backend payloads

### Director Review Needed

- confirm whether the next round should prioritize:
  - read-only UI composition for bots/signals
  - registry persistence seam
  - feed ranking/prioritization

## 2026-03-19 - Read-Only Domain Validation Round

### Phase

Phase 2 / Phase 3 bridge

### Completed

- Added a memory-based adapter from `SignalSnapshot[]` into the new published signal feed model under `src/domain/signals/memoryAdapters.ts`.
- Kept the feed hydration source on `signal memory snapshots`, as directed, instead of starting from execution candidates or backend payloads.
- Extended the bot-consumable signal contract so the derivation can expose policy-fit details:
  - universe match
  - timeframe match
  - strategy match
  - policy notes
- Added signal selectors under `src/domain/signals/selectors.ts` for:
  - published feed reads
  - audience slicing
  - high-confidence slicing
  - accepted vs blocked bot-consumable reads
- Built a first read-only inspection surface in `src/components/domain/SignalsBotsReadOnlyLab.tsx`.
- Mounted that surface inside the existing `MemoryView` overview tab so the new domain can be inspected without touching `App.tsx` or shared runtime wiring.
- Added light/dark theme-safe styles for the new inspection surface in `src/styles/content.css`.
- Verified the round with:
  - `npm run typecheck`
  - `npm run build`

### Mapping Used

- `signal memory snapshots` -> `published signal feed`
  - source classification uses active watchlist membership to split `watchlist` vs `market`
  - visibility score is derived from base signal score plus confirmations, watchlist bias, and execution-eligibility hint
- `published signal feed` + `bot policy` -> `bot-consumable feed`
  - current policy fit checks:
    - universe policy
    - allowed timeframes
    - allowed strategies

### UI Built

- New read-only lab surface:
  - published signals
  - high-confidence subset
  - bot policy fit summaries
  - bot-consumable examples showing accepted vs blocked cases
- Host location:
  - `MemoryView` -> `Resumen`
- Why this seam is safe:
  - no new fetch
  - no polling added
  - no new runtime
  - no hot-path integration

### Files Added

- `src/domain/signals/memoryAdapters.ts`
- `src/domain/signals/selectors.ts`
- `src/components/domain/SignalsBotsReadOnlyLab.tsx`

### Files Updated

- `src/domain/signals/contracts.ts`
- `src/domain/signals/classification.ts`
- `src/domain/index.ts`
- `src/views/MemoryView.tsx`
- `src/styles/content.css`

### Sensitive Areas Avoided

- Still avoided:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - protected hooks
  - `api/_lib/*`

### What We Learned

- The domain seam remains safe when the first hydration source is `signal memory`, because it gives enough structure to validate:
  - published feed taxonomy
  - bot-consumption derivation
  - policy readability in UI
- Before persistence, the more valuable next step is likely feed ranking/prioritization, because:
  - the UI can already inspect the domain
  - the bigger product risk now is noise management, not local bot registry storage

### Warning

- The working branch currently contains a prior realtime refinement commit (`390d0aa`) that does not belong to the implementer scope originally assigned.
- This round did not touch that area, but the director should take the branch contamination into account during later integration review.

### Publication Note

- This round was published from a clean branch derived from `origin/codex/implementador-bots-signals` to avoid carrying realtime refinement commits outside implementer scope.
- The functional content of the round did not change during cleanup; only the publication path changed.

### Recommended Next Step

- move to ranking/prioritization on top of the published feed
- keep persistence deferred
- keep the next integration read-only until feed quality and visual organization are validated

## 2026-03-19 - Feed Ranking Round

### Phase

Phase 3 - feed ranking / prioritization

### Completed

- Added an explicit ranking layer for `published feed` under `src/domain/signals/ranking.ts`.
- Kept the original feed separation intact:
  - raw published feed
  - ranked published feed
  - high-confidence subset
- Defined a readable composite ranking model using:
  - watchlist bias
  - base score strength
  - visibility score carryover
  - timeframe legibility
  - market-context completeness
  - reason/explainability density
  - directional clarity
- Added ranking tiers:
  - `high-confidence`
  - `priority`
  - `standard`
  - `low-visibility`
- Added ranking selectors so the UI can inspect:
  - ranked feed
  - priority feed
  - high-confidence ranked subset
  - demoted signals
- Extended the read-only lab to show:
  - raw feed
  - ranked feed
  - ranking promotions
  - ranking degradations
  - ranked high-confidence subset
  - bot-consumable derivation from the ranked feed
- Added visible boosts/penalties so the final order is explainable instead of opaque.
- Verified the round with `npm run typecheck`.

### Ranking Behavior

- signals move up when they have:
  - active watchlist relevance
  - strong base score
  - already strong visibility
  - clearer timeframes such as `1h` or `4h`
  - known market context
  - richer reasons
  - defined direction
- signals move down when they have:
  - weak base score
  - noisy timeframes such as `5m`
  - incomplete market context
  - low explainability
  - neutral direction

### Files Added

- `src/domain/signals/ranking.ts`

### Files Updated

- `src/domain/signals/contracts.ts`
- `src/domain/signals/selectors.ts`
- `src/domain/index.ts`
- `src/components/domain/SignalsBotsReadOnlyLab.tsx`
- `src/styles/content.css`

### Sensitive Areas Avoided

- Still avoided:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - protected hooks
  - `api/_lib/*`

### What We Learned

- The current read-only lab is still sufficient for this phase.
- It can hold one more ranking-validation round without needing a dedicated workspace surface yet.
- A bigger visual split should wait until the ranked feed shape stabilizes.

### Recommended Next Step

- keep iterating on ranking defensibility and noise reduction
- refine high-confidence thresholds using real signal-memory evidence
- only consider a bigger dedicated signals/bots surface after ranking behavior feels stable

## 2026-03-19 - Ranking Thresholds And Noise Split Round

### Phase

Phase 3 - feed ranking refinement

### Completed

- Tightened `high-confidence` thresholds so the subset is no longer driven mainly by a single composite cutoff.
- Split the ranked feed into explicit lanes:
  - `watchlist-first`
  - `market-discovery`
- Made `market-discovery` stricter than `watchlist-first` by design:
  - higher thresholds
  - extra penalty for noisy discovery contexts
  - stronger gating before signals can reach `high-confidence`
- Added lane-aware selectors for:
  - watchlist-first ranked signals
  - market-discovery ranked signals
- Kept `raw published feed`, `ranked feed`, and `high-confidence subset` separate.
- Updated the read-only lab to show:
  - a clearer hero/header section
  - more hierarchical quick stats
  - lane segmentation
  - explicit promoted vs degraded ranking moves
  - a clearer split between:
    - overview
    - ranked feed
    - strong subset
    - bot derivation
- Used `TradeBotX` only as a UX/layout reference for:
  - stronger page hierarchy
  - dense quick stats
  - visible segmentation
  - more distinct operational blocks
- Did not copy template HTML or move this layer into a final dedicated module yet.

### Threshold Changes

- `watchlist-first`
  - `high-confidence` now requires a higher score plus:
    - zero major penalties
    - a minimum boost count
- `market-discovery`
  - requires even higher thresholds than watchlist-first
  - gets a discovery penalty by default because the feed is more prone to noise
  - 15m market discovery is penalized further to avoid low-quality promotion

### Signals That Now Stop Rising

- market-wide signals with:
  - incomplete market context
  - neutral direction
  - noisy intraday discovery context
  - weak explainability
- these signals still remain visible in the raw feed, but are now more likely to stay in:
  - `standard`
  - or `low-visibility`
  instead of rising into priority or high-confidence too early

### Files Updated

- `src/domain/signals/contracts.ts`
- `src/domain/signals/ranking.ts`
- `src/domain/signals/selectors.ts`
- `src/components/domain/SignalsBotsReadOnlyLab.tsx`
- `src/styles/content.css`

### Sensitive Areas Avoided

- Still avoided:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - protected hooks
  - `api/_lib/*`

### Visual Direction Note

- The lab remains sufficient for one more refinement round.
- It now starts to move toward the intended future pattern:
  - clearer top hierarchy
  - stronger quick stats
  - visible segmentation
  - stronger operational blocks
- A dedicated surface still feels premature until ranking thresholds stabilize further.
