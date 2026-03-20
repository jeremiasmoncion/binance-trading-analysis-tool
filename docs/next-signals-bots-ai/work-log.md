# Work Log

## 2026-03-19

### Phase

`Bot Settings` risk-management template round

### Completed

- Replaced the old summary-card placeholder in `Bot Settings -> Risk Management` with a fuller control surface aligned to the template flow.
- Added UI-stage sections for:
  - `Global Risk Controls`
  - `Stop Loss & Take Profit`
  - `Emergency Controls`
  - `Reset to Default`
  - `Save Risk Settings`
- Reused the same shared form primitives already established for `General Settings`:
  - `ui-input-shell`
  - shared select shell
  - shared toggle row
  - shared action-row pattern
- Kept `Risk Management` on the same theme-parity discipline learned from `General Settings`:
  - no local select hacks
  - no theme-forced overrides
  - clear/light mode covered in the same round

### Risk Avoided

- Building `Risk Management` as another one-off page-specific form system would repeat the same drift that already had to be corrected in `General Settings`.
- Reusing the shared shells means the next settings tabs can keep converging on one form language instead of multiplying styling fixes per page.

### Recommended Next Step

- Continue with `Notifications` using the same rule:
  - shared form primitives first
  - theme parity in the same round
  - page-specific layout only where structure is truly different

### Phase

`Bot Settings` notifications template round

### Completed

- Replaced the old notification summary placeholders with a fuller settings surface inside `Bot Settings -> Notifications`.
- Added UI-stage sections for:
  - `Notification Channels`
  - `Alert Types`
  - `Reset to Default`
  - `Save Notification Settings`
- Kept the channel/action rows on the same shared settings language already used in:
  - `General Settings`
  - `Risk Management`
- Preserved the same implementation guardrails:
  - shared toggles
  - same card/panel primitives
  - no local theme hacks
  - clear/dark parity in the same round

### Risk Avoided

- Without this continuity, `Notifications` would become another one-off page inside `Bot Settings`, forcing more repeated fixes for theme, spacing and control treatment.

### Recommended Next Step

- Continue with `API Connections` on the same form/control baseline so the full `Bot Settings` tab family stays visually and structurally coherent.

### Phase

`Bot Settings` api-connections template round

### Completed

- Replaced the old API placeholder cards with a fuller `API Connections` surface.
- Added UI-stage sections for:
  - `Connected Exchanges`
  - exchange cards with sync/settings/delete actions
  - `Add Exchange`
  - `API Security Best Practices`
- Kept the tab on the same shared visual/control architecture used across the rest of `Bot Settings`:
  - shared cards
  - shared button language
  - shared status pills
  - same dark/light theme parity discipline

### Risk Avoided

- This avoids leaving `API Connections` as the only shallow tab in the `Bot Settings` family and prevents another round of one-off visual fixes later.

### Recommended Next Step

- Review the full `Bot Settings` tab family together and tighten any remaining spacing or typography mismatches as one cohesive surface instead of per-tab patching.

### Phase

`Bot Settings` quick-edit drawer round

### Completed

- Added a quick-edit surface from the gear button on each bot card inside `Bot Settings -> All Bots`.
- Implemented it as a right-side drawer instead of a detached popup so the user can keep the bot grid visible in context.
- Added UI-stage quick controls for:
  - bot name
  - investment amount
  - range lower / upper
  - number of grids
  - stop loss / take profit
  - auto-compound toggle
  - delete / cancel / save actions
- Kept the drawer on the same shared control language already used in the rest of `Bot Settings`:
  - shared form inputs
  - shared toggle row
  - shared action buttons
  - theme parity in the same round

### Risk Avoided

- This avoids sending users to a different full page for a lightweight edit and avoids introducing a second modal/dialog system just for bot quick edits.

### Recommended Next Step

- Review the all-bots card grid and quick-edit drawer together for micro-alignment:
  - spacing
  - typography
  - drawer density
  - button hierarchy

### Phase

Global active-tab parity fix

### Completed

- Fixed active tab/chip persistence at the shared theme layer instead of per-page overrides.
- The selected tab state now keeps its highlighted color in both:
  - dark theme
  - light theme
- Applied the fix to the shared `ui-chip.active` treatment so future tab-based pages inherit the correct selected-state behavior automatically.

### Risk Avoided

- Without moving this to the global theme layer, each new tabbed page could silently lose its selected-state highlight again as soon as theme overrides were applied.

### Recommended Next Step

- Reuse shared tab/chip primitives on future pages instead of inventing local active-state styling.

### Phase

System loading identity refinement

### Completed

- Traced the startup loading surface to the real source component: `StartupOverlay`, not just the shared `SystemUiHost`.
- Replaced the static `C` in the startup overlay mark with a true spinner animation inside the same slot.
- Kept the same loading surface and wording, but removed the static letter so the mark now communicates real progress.
- Documented the rule that future loader tweaks must first confirm which loading surface is actually rendering.

### Risk Avoided

- This avoids repeating false-positive fixes on the wrong loader while the visible startup screen keeps shipping unchanged.
- It also avoids leaving a static brand letter in a place that users expect to behave like a loading indicator.

### Recommended Next Step

- Reuse the same spinner treatment for compact startup marks and confirm surface ownership before editing other global loaders.

### Phase

`Bot Settings` -> full bot workspace routing

### Completed

- Added a shared selected-bot seam so `Bot Settings` can choose the active bot detail target without inventing a local navigation state.
- Kept the gear drawer in `All Bots` as quick settings only.
- Made the full bot navigation flow open the current detailed bot workspace screen from `All Bots`.
- Reworked `Signal Bot` so it reads the selected bot context and behaves as the full-screen workspace for the bot chosen in `Bot Settings`.

### Risk Avoided

- Without a shared selected-bot seam, `Bot Settings` and the full bot workspace would drift apart and require page-local state hacks.
- This also avoids multiplying separate detail-page patterns before the product model is ready for dedicated pages per bot family.

### Recommended Next Step

- Keep using `Signal Bot` as the shared detailed bot workspace while the product converges, then split into dedicated bot detail pages only when each family truly needs its own full template.

### Phase

Template-fidelity refinement for `Signal Bot`

### Completed

- Revisited `Signal Bot` with `My Wallet` treated as the live implementation baseline, not just the static template screenshot.
- Reworked the `Signal Bot` visual system so it now leans on the same CRYPE visual language used by `My Wallet`:
  - display typography rhythm
  - quick-stat card treatment
  - chip/button density
  - dark panel contrast
  - shared spacing discipline
- Rebuilt the active-signal cards with stronger CRYPE-consistent panel treatment while keeping the template page flow.
- Tightened signal direction display so cards can surface `BUY` / `SELL` more reliably from the shared signal snapshot instead of drifting into neutral-only presentation.
- Updated UX/style documentation to make `My Wallet` the explicit implementation baseline for future template pages, especially `Signal Bot`.

### Risk Avoided

- Without locking `Signal Bot` to the same visual baseline as `My Wallet`, the redesign risked drifting into a second interface language:
  - correct structure
  - but visibly different product feel
- That would make template migration harder to scale page by page and increase one-off styling debt.

### Recommended Next Step

- Review `Signal Bot` again against the reference and continue polishing:
  - typography scale
  - card icon fidelity
  - spacing micro-alignment
  - badge and action-row matching
  until it feels visibly part of the same CRYPE family as `My Wallet`

### Phase

Phase 2 / Phase 3 bridge

### Completed

- Added a shared `signals + bots` read-model seam in `src/hooks/useSignalsBotsReadModel.ts`.
- Moved `Signal Bot`, `Bots`, `Bot Settings` and `Control Panel -> Overview` away from rebuilding the same ranked feed pipeline inside each view.
- Narrowed template control surfaces to dedicated selectors:
  - `useControlPanelExecutionSelector`
  - `useExecutionLogsSelector`
- Removed `Control Panel -> Overview`, `Bot Settings` and `Execution Logs` from the broader `useMemorySystemSelector` dependency when they only needed a smaller shared slice.
- Updated the architecture doc with the new rule so future template pages reuse the same shared feed/read-model seam instead of inventing local derivations.

### Risk Avoided

- As `Signal Bot`, `Control Panel`, `Bot Settings` and future template pages grow, duplicating the ranked-feed derivation per screen would create drift and make performance tuning harder.
- Keeping those pages on broader runtime selectors would also wake them on unrelated scanner/admin churn even when their real inputs had not changed.

### Recommended Next Step

- Continue the same closure pattern on the next template page:
  - narrow selector first
  - shared read-model seam second
  - page-local presentation logic last

### Phase

UX architecture clarification and template-flow lock

### Completed

- Reviewed the template screenshots as the final authority for:
  - sidebar order
  - submenu hierarchy
  - page nesting
  - top-level section grouping
  - page composition patterns
- Upgraded the UX direction from "template-inspired" to "template-matching".
- Documented the official sidebar architecture for:
  - `MAIN`
  - `TRADING & BOTS`
  - `DEFI & PORTFOLIO`
  - `MARKETPLACE`
- Documented the official template-matching flow for:
  - `Trading`
  - `Control Panel`
  - `Bot Settings`
  - `Execution Logs`
  - `AI Bot`
  - `Signal Bot`
- Documented the rule that end-user surfaces must show the minimum useful information and translate technical internals into simpler product language whenever possible.
- Documented that CRYPE must preserve the migrated visual line from `Dashboard` and `My Wallet` while matching the template flow exactly.
- Added a dedicated style architecture document for template-faithful but well-architected CSS implementation.
- Added a dedicated product operating model document for the agreed business and product logic.
- Added a dedicated AI context pack so a single new AI can onboard into the entire project without relying on prior thread memory.

### Decisions Captured

- The template is now the official UX flow standard, not loose inspiration.
- Sidebar grouping, nesting, and page logic should match the template unless a deviation is explicitly justified.
- The sidebar lower `ACCOUNT` section and bottom user block are part of the required template flow.
- Logout should not remain as an isolated loose action outside the account/user zone.
- Visible naming inside pages should also follow the template by default, including labels, tabs, sections, statuses, and record naming.
- The old legacy `Signal Bot` surface should no longer drive the future UX.
- Technical or admin-heavy information should be translated or withheld from the main user journey.

### Recommended Next Step

Direct the implementer toward exact template-flow migration and direct the refiner toward runtime protection while that migration is mounted.

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

## 2026-03-19 - Realtime Overlay Stability

### Area

Shared realtime overlay application

### Completed

- Made `src/realtime-core/events.ts` no-op aware for `system.overlay.updated`.
- Stopped identical overlay frames from rewriting `connection`, `execution`, and `dashboardSummary` in the shared `system plane`.
- Narrowed heartbeat writes so routine liveness frames only touch stream metadata when the plane is already healthy.
- Updated the architecture doc with the new runtime rule.

### Risk Avoided

- Future bot runtime expansion will increase the density and frequency of operational overlays.
- Without overlay-level deduplication, selector-driven screens would keep rerendering on semantically identical frames.
- That would scale poorly once bot-owned runtime state starts sharing the same hot path.

### Pending

- Evaluate whether emit-side deduplication should also happen in `realtime-core-service/server.mjs`.
- Continue auditing shared runtime paths for equivalent payload writes.

### Recommendation To Director

- Keep `src/realtime-core/events.ts` treated as protected runtime infrastructure.
- Route future bot/live state through the shared runtime path instead of allowing per-screen event consumers.

## 2026-03-19 - Domain Model Foundation

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

## 2026-03-19 - Realtime Overlay Semantic Emit Dedup

### Area

Persistent realtime-core overlay emission

### Completed

- Added semantic overlay hashing inside `realtime-core-service/server.mjs`.
- Stopped the external core from treating freshness-only timestamp changes as new `system.overlay.updated` payloads.
- Kept the emitted overlay payload intact for operators while normalizing only the dedup comparison path.
- Updated the shared architecture doc with the emit-side rule.

### Risk Avoided

- The dual `signals + bots + AI` model will increase the number of read-only consumers sharing the same operational overlay.
- Without emit-side semantic deduplication, volatile timestamps would keep publishing equivalent overlays and wake selector-driven surfaces unnecessarily.
- That would scale poorly as more bot/runtime state reuses the same shared hot path.

### Pending

- Audit whether future bot-specific overlay slices should still travel through `system.overlay.updated` or split into a finer taxonomy.
- Continue auditing shared runtimes for equivalent writes that still originate outside the realtime core.

### Recommendation To Director

- Treat `realtime-core-service/server.mjs` as protected runtime infrastructure for future bot/live integrations.
- Require new bot/live emitters to reuse semantic dedup rules instead of publishing freshness-only overlay frames.

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

## 2026-03-19 - Raw Vs Ranked Explainability Round

### Phase

Phase 3 - explainability refinement

### Completed

- Added human-readable explainability fields directly to the ranked signal model:
  - `rawScore`
  - `delta`
  - `movement`
  - `primaryReason`
  - `summary`
- Improved `market-discovery` pruning by applying an extra downgrade when discovery signals combine:
  - weak context
  - neutral direction
  - noisy timeframe
  - limited explainability
- Reworked the temporary lab to explain ranking in more human terms:
  - whether a signal goes up, down, or stays stable
  - what changed from raw to ranked
  - what the main reason was
- Added a dedicated `raw vs ranked explainability` block so a reviewer can quickly read:
  - original score
  - ranked score
  - lane
  - tier
  - movement
  - primary reason
- Kept the host temporary, but organized the lab more like a product surface:
  - overview
  - watchlist-first
  - market discovery
  - high-confidence
  - bot-consumable

### Discovery Signals Further Pruned

- additional market-wide signals are now less likely to rise when they combine:
  - incomplete context
  - neutral direction
  - intraday noise
  - weak explainability
- these still exist in raw feed for inspection, but are more likely to land in:
  - `low-visibility`
  - or lower `standard`

### Files Updated

- `src/domain/signals/contracts.ts`
- `src/domain/signals/ranking.ts`
- `src/components/domain/SignalsBotsReadOnlyLab.tsx`
- `src/styles/content.css`

### What We Learned

- the temporary lab is still sufficient after this round
- it now supports human review much better, especially for:
  - what was promoted
  - what was degraded
  - why a discovery signal did not make the cut
- a dedicated final surface still feels premature until explainability language and pruning behavior stabilize further

## 2026-03-19 - Shared Runtime Semantic Dashboard Refresh

### Area

Hybrid Binance runtime refresh stability

### Completed

- Hardened `src/hooks/useBinanceData.ts` so `dashboardSummary` refreshes ignore freshness-only `generatedAt` changes.
- Upgraded the dashboard comparator to look at `topAssets` and recent execution orders semantically instead of treating every refresh as new.
- Made Binance alias hydration no-op aware so profile refreshes do not rewrite the form state when the alias is already current.
- Updated the architecture doc with the runtime rule.

### Risk Avoided

- The future dual runtime will add more read-only surfaces watching the same dashboard summary.
- Without semantic summary comparison, hybrid safety refreshes would keep waking shared selectors even when only metadata changed.
- Equivalent control writes, like alias rehydration, would also keep rippling through the shell for no user-visible change.

### Pending

- Continue auditing shared hooks for semantic-no-op gaps outside `useBinanceData`, especially any remaining hybrid refresh paths that still mix snapshot safety polling with overlay-driven state.
- Revisit whether execution-center comparison also needs deeper semantic checks once bot-owned operational state grows.

### Recommendation To Director

- Keep treating hybrid runtime comparators as protected infrastructure, not view-level behavior.
- Require future bot-facing summary/read-model hooks to define semantic equality up front instead of relying on timestamped payload identity.

## 2026-03-19 - Execution Center Semantic Stability

### Area

Shared execution runtime comparator hardening

### Completed

- Hardened `src/hooks/useBinanceData.ts` so `ExecutionCenterPayload` equality is semantic instead of shallow.
- Added comparator coverage for:
  - `allowedStrategies`
  - `allowedTimeframes`
  - `scopeOverrides`
  - candidate cohorts
  - recent-order cohorts
- Kept equality logic in shared runtime infrastructure instead of letting future template pages decide stability locally.
- Updated the architecture doc with the protected seam rule.

### Risk Avoided

- The exact template UX will introduce more tabs, cards and tables reading the same execution payload.
- With the previous shallow comparator, equivalent refreshes could still wake those surfaces simply because arrays were recreated or because only the first order was inspected.
- That would scale poorly as bots, signals and AI surfaces reuse the same execution runtime.

### Pending

- Continue auditing other hybrid comparators for array/object recreation outside the realtime core.
- Revisit whether scanner and validation payload equality needs the same deeper cohort-level treatment as the new UX expands.

### Recommendation To Director

- Keep execution-runtime comparators in protected shared infrastructure.
- Forbid page-level custom equality/memoization as a substitute for missing runtime stability in new template surfaces.

## 2026-03-19 - Template Feed Selector Narrowing

### Area

Selector-driven stability for template read-only pages

### Completed

- Added a dedicated shared selector for the new `Signals` and `Bots` feed inputs.
- Moved `src/views/SignalsView.tsx` and `src/views/BotsView.tsx` off the broad `useMemorySystemSelector` bundle.
- Limited those pages to the snapshot inputs they actually need:
  - `signalMemory`
  - `watchlists`
  - `activeWatchlistName`
- Updated architecture documentation with the selector-granularity rule for future template pages.

### Risk Avoided

- The template migration will add more read-heavy pages that look simple but can accidentally subscribe to the whole runtime.
- Without narrow selectors, new `Signal Bot` / `Bot Settings` style pages would rerender on execution, scanner or admin-state churn they do not actually use.
- That kind of over-subscription would scale poorly as more tabs and cards are layered onto the shared system plane.

### Pending

- Keep auditing remaining template-facing pages for oversized selectors or broad runtime subscriptions.
- Revisit whether `ControlPanelView` and future `Execution Logs` surfaces need dedicated selector seams before more real data gets attached.

### Recommendation To Director

- Keep selector granularity treated as runtime infrastructure, not as a view-by-view cleanup concern.
- Require new template pages to ask for the smallest shared selector that matches their data contract.

## 2026-03-19 - Scanner Runtime Cohort Stability

### Area

Shared scanner/runtime comparator hardening

### Completed

- Hardened `src/hooks/useMemoryRuntime.ts` so scanner status equality is semantic instead of shallow.
- Added comparator coverage for:
  - scanner target cohorts
  - scanner run cohorts
- Kept scanner/runtime stability in shared infrastructure rather than pushing compensation into future `Control Panel` or `Execution Logs` pages.
- Updated architecture docs with the scanner comparator rule.

### Risk Avoided

- The template flow will eventually attach denser operational surfaces to scanner/runtime state.
- With shallow equality, equivalent refreshes could still wake those pages simply because runs or targets were recreated with the same meaning.
- That would encourage page-local memoization patches instead of fixing the shared runtime seam once.

### Pending

- Continue auditing other shared runtime comparators that may still use shallow array checks for denser cohorts.
- Revisit whether validation/runtime reports need a similar narrowing once `Control Panel` grows real history and operations surfaces.

### Recommendation To Director

- Keep scanner/runtime comparator depth treated as protected infrastructure for the template migration.
- Do not let future UI rounds solve scanner churn from the component layer.

## 2026-03-19 - Signal Bot Active Watchlist Narrowing

### Area

Selector granularity for the `AI Bot -> Signal Bot` page

### Completed

- Narrowed the shared selector used by `SignalsView` and `BotsView` again.
- Replaced the full watchlist collection dependency with only:
  - `signalMemory`
  - `activeWatchlistName`
  - `activeWatchlistCoins`
- Added selector-level equality so non-active watchlist edits do not wake `Signal Bot`.
- Updated architecture docs with the page-specific selector rule.

### Risk Avoided

- `Signal Bot` is about to gain more filters, cards and denser feed surfaces.
- If it stayed subscribed to the whole watchlist collection, edits to non-active lists would still rerender the page and all of its derived ranking/read-model work.
- That would push the implementador toward UI-level defensive memoization instead of fixing the shared seam once.

### Pending

- Continue auditing whether upcoming `Signal Bot` tables/history blocks need further selector splitting once they hydrate richer datasets.
- Revisit whether the feed/ranking read-model itself should move behind a shared memo seam if the page grows significantly more tabs and summaries.

### Recommendation To Director

- Keep `Signal Bot` selector granularity treated as runtime protection, not as a later UI optimization.
- Require future Signal Bot growth to widen selectors only when a new data contract truly needs it.

## 2026-03-19 - User-Facing Signals And Bots Navigation Reform

### Phase

Phase 3 - UX architecture reform

### Completed

- Stopped treating the legacy `Signal Bot` page as the main visual home for the redesign.
- Added two new user-facing pages:
  - `Signals`
  - `Bots`
- Wired those pages directly into the main sidebar so the new work is no longer buried inside the old `MemoryView` flow.
- Updated the dashboard actions so the user can jump into:
  - `Signals`
  - `Bots`
- Built a first dedicated `Signals` surface for end users:
  - overview
  - watchlist-first
  - market discovery
  - high confidence
  - history
- Built a first dedicated `Bots` surface for end users:
  - bot list
  - simple bot performance summary
  - simplified "how it works" explanation
- Kept the underlying new domain logic reusable instead of rebuilding signal logic inside the old legacy page.

### Why This Matters

- The redesign can no longer be judged from a buried internal lab only.
- The user now has visible first-class destinations for signals and bots, closer to the `TradeBotX` navigation model.
- The old page may remain in code temporarily, but it is no longer the only discoverable path for the new product direction.

### Files Added

- `src/views/SignalsView.tsx`
- `src/views/BotsView.tsx`

### Files Updated

- `src/types.ts`
- `src/components/AppView.tsx`
- `src/components/Sidebar.tsx`
- `src/views/DashboardView.tsx`
- `src/styles/content.css`

### Pending

- Continue refining these new pages so they fully replace the legacy `Signal Bot` user experience.
- Decide whether the legacy `memory` route should later become an admin/technical surface only.
- Move more of the new signals/bots experience out of temporary/internal hosts and into these dedicated user pages.

### Recommended Next Step

- keep refining the new `Signals` and `Bots` pages as the primary user flow
- stop investing product UX effort into the old `Signal Bot` page
- let technical/admin detail live elsewhere later if needed

## 2026-03-19 - Template Flow Navigation Migration

### Phase

Phase 3 - template-faithful navigation and page architecture

### Completed

- Rebased the implementer UX work onto the integrated direction and stopped treating generic `Signals` and `Bots` pages as the visible end state.
- Replaced the visible sidebar flow with the `TradeBotX` hierarchy using CRYPE's shared style architecture:
  - `MAIN`
    - `Dashboard`
    - `My Wallet`
    - `My Statistics`
  - `TRADING & BOTS`
    - `Trading`
    - `Control Panel`
      - `Overview`
      - `Bot Settings`
      - `Execution Logs`
    - `AI Bot`
      - `Signal Bot`
      - `DCA Bot`
      - `Arbitrage Bot`
      - `Pump Screener`
  - `DEFI & PORTFOLIO`
  - `MARKETPLACE`
- Added first template-aligned product pages for:
  - `Control Panel -> Overview`
  - `Control Panel -> Bot Settings`
  - `Control Panel -> Execution Logs`
  - `AI Bot -> Signal Bot`
- Added explicit placeholders for the remaining template destinations so the visible navigation is already correct without inventing interim UX.
- Retargeted the dashboard entry actions to the new flow:
  - Signal CTA -> `AI Bot -> Signal Bot`
  - Bot CTA -> `Control Panel -> Bot Settings`

### Reused

- Existing shared selectors from `src/data-platform/selectors.ts`
- The new domain layer under `src/domain/` for:
  - ranked published feed
  - high-confidence subset
  - bot consumable feed
  - bot registry snapshot
- Shared CRYPE visual architecture from:
  - `Dashboard`
  - `My Wallet`
  - shared buttons/cards/tokens/layout classes

### Files Added

- `src/views/ControlOverviewView.tsx`
- `src/views/BotSettingsView.tsx`
- `src/views/ExecutionLogsView.tsx`
- `src/views/SignalBotView.tsx`
- `src/views/TemplatePlaceholderView.tsx`

### Files Updated

- `src/types.ts`
- `src/components/Sidebar.tsx`
- `src/components/AppView.tsx`
- `src/views/DashboardView.tsx`
- `src/styles/content.css`

### Risk Avoided

- Avoided extending the legacy signals/bots UX as if it were the final destination.
- Avoided copying template CSS patterns directly into the app.
- Avoided touching protected runtime/data-plane files while still moving the visible product flow to the correct architecture.

### Pending

- Make the new pages even more literal where the template uses richer controls, especially:
  - filters/search interactions
  - deeper subpage content
  - drawer/table/card behavior
- Decide when the old `SignalsView`, `BotsView`, and `ControlPanelView` become removable instead of merely bypassed.
- Fill the placeholder template routes as later product phases open.

### Recommended Next Step

- Continue refining the new template-matched pages instead of reopening generic `Signals` / `Bots` surfaces
- Replace remaining transitional content inside those pages with more literal template behavior where direction approves it

## 2026-03-19 - Template Naming And Account Sidebar Pass

### Phase

Phase 3 - template naming and deeper product surfaces

### Completed

- Completed the lower sidebar structure so it now follows the template more literally:
  - added `Account`
  - added `Preferences`
  - added `Notifications`
  - added `Security & API Keys`
  - added `Invite Friends`
  - added `Subscription`
  - added `Help Center`
- Integrated `Logout` into the user/account block instead of leaving it as an isolated button.
- Added the missing `Bot Templates` entry under `Marketplace`.
- Tightened visible naming so the new pages use template-facing labels for:
  - tabs
  - columns
  - status names
  - action labels
- Deepened the content of the first live template pages:
  - `Control Panel -> Overview`
  - `Control Panel -> Bot Settings`
  - `Control Panel -> Execution Logs`
  - `AI Bot -> Signal Bot`
- Kept all of that on top of CRYPE's shared style architecture instead of importing template CSS patterns directly.

### Why This Matters

- The app now reads much closer to the actual product language of the template, not just its structure.
- The sidebar no longer feels truncated relative to the reference standard.
- The new pages are no longer just layout shells; they are closer to product-ready reading surfaces.

### Files Updated

- `src/types.ts`
- `src/components/Sidebar.tsx`
- `src/components/AppView.tsx`
- `src/views/ControlOverviewView.tsx`
- `src/views/BotSettingsView.tsx`
- `src/views/ExecutionLogsView.tsx`
- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `src/styles/layout.css`

### Pending

- The remaining placeholder routes still need their full content when direction opens those product areas.
- Some legacy transitional views still remain in the repo, though they are no longer the primary destination.
- A later round may still be needed to make micro-interactions even closer to the template:
  - richer filters
  - drawers
  - more stateful controls

### Recommended Next Step

- keep deepening the template-faithful pages already opened
- decide when to retire the transitional legacy views that no longer represent the target UX

## 2026-03-19 - Signal Bot Page Closure Pass

### Phase

Phase 3 - page-by-page closure

### Completed

- Treated `AI Bot -> Signal Bot` as the first page to close as a real product surface.
- Switched the page to the narrower selector already available for signals/bots feed reading:
  - `useSignalsBotsFeedSelector`
- Stopped relying on the broader memory selector bundle for this page.
- Strengthened `Active Signals` as the main subview:
  - live chips/filters
  - stronger signal cards
  - entry / target / stop loss hierarchy
  - visible user actions
  - cleaner user-facing summaries
- Deepened `Signal History` into a denser template-aligned table with:
  - pair
  - type
  - entry
  - exit
  - P/L
  - duration
  - status
  - date
- Expanded `Performance` into a more complete user-facing summary.
- Simplified `Bot Settings` to the minimum useful controls for the end user.
- Added the lower product blocks from the template:
  - `Market Sentiment`
  - `AI Insights`
  - `Top Signal Performers`

### Reused

- signal memory snapshots as the base read source
- ranked published feed from the new domain
- high-confidence subset
- bot-consumable feed for policy-fit awareness
- CRYPE shared style architecture instead of template CSS copy

### Why This Matters

- `Signal Bot` is now the most mature page in the new flow.
- It can serve as the reference page for closing the rest of the template one page at a time.
- The page now feels closer to product and less like a transitional scaffold.

### Files Updated

- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Pending

- The page can still get richer later with deeper interaction patterns if direction wants:
  - drawers
  - richer exports
  - more interactive filters
- But the core visible page architecture and user-facing logic are now substantially closer to closed.

### Recommended Next Step

- use `Signal Bot` as the benchmark page for the next page-closure rounds
- choose the next page and close it with the same full-page discipline

## 2026-03-19 - Signal Bot Literal Fidelity Pass

### Phase

Phase 3 - Signal Bot hard-close refinement

### Completed

- Pushed `Signal Bot` closer to the template visually in a more literal way, not just structurally.
- Reworked the interior rhythm of the page to better match the template in:
  - top stat cards
  - tab container rhythm
  - chip row density
  - active signal card proportions
  - side panel hierarchy
  - lower insight blocks
- Rebuilt the top stats as page-specific cards instead of relying on a more generic summary surface.
- Strengthened `Active Signals` so it now feels more like the template's main product area:
  - stronger price-level treatment for entry / target / stop loss
  - stronger confidence bar hierarchy
  - clearer action row
  - more literal card density and vertical rhythm
- Kept `Signal History` in the template table shape while improving semantic usefulness.
- Tightened the lower blocks so:
  - `Market Sentiment`
  - `AI Insights`
  - `Top Signal Performers`
  feel more like real product modules and less like generic support cards.

### Functional Improvement

- Kept the page on the narrower feed selector:
  - `useSignalsBotsFeedSelector`
- Continued using real derived data from:
  - signal memory snapshots
  - ranked published feed
  - high-confidence subset
  - bot-consumable filtering
- Added more useful real-page derivations for:
  - filtered active cards
  - history rows
  - top performers
  - market sentiment summary
  - AI insight summaries

### User-Facing Simplification

- Continued translating technical ranking into simpler user-facing terms:
  - `AI Confidence`
  - `Completed`
  - `Pending`
  - `Top Signal Performers`
- Avoided dumping raw domain mechanics into the page.
- Kept `Bot Settings` in-page content minimal and user-readable instead of exposing internal system complexity.

### Files Updated

- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Recommended Next Step

- Treat `Signal Bot` as the reference-quality page for the next closure round
- Only continue here later if direction wants final polish beyond this near-closed state

## Bot Settings Hub Round

### What Changed

- Rebuilt `Control Panel -> Bot Settings` on the same visual baseline used by `My Wallet`.
- Moved the page away from the older generic template blocks into:
  - wallet-like quick summary cards
  - exact tab rail for bot/platform settings sections
  - search + status filters + grid/table toggle
  - hoverable bot cards with stronger hierarchy
- Each bot card now exposes a direct settings action that routes to the matching bot surface when that route already exists.

### Shared Data Continuity

- Kept the page on the shared `useSignalsBotsReadModel()` seam.
- Extended the seam with bot-level summary data instead of rebuilding wide derivations only inside the page.
- Continued using the shared signal-memory + ranked-feed pipeline to enrich bot cards.

### Bot Registry Continuity

- Expanded the initial bot registry so `Bot Settings` reflects the actual bot family the product is preparing for:
  - `Signal Bot Core`
  - `DCA Bot Core`
  - `Arbitrage Bot Core`
  - `Pump Screener`
  - `AI Unrestricted Lab`
- This does not create a second runtime.
- It only makes the shared registry seed more faithful to the intended product map.

### Files Updated

- `src/domain/bots/defaults.ts`
- `src/hooks/useSignalsBotsReadModel.ts`
- `src/components/AppView.tsx`
- `src/views/BotSettingsView.tsx`
- `src/styles/content.css`

## Bot Settings General Settings Round

### What Changed

- Deepened `Bot Settings -> General Settings` so it no longer reads like a row of summary cards.
- Added a more literal settings surface with:
  - trading preferences
  - automation toggles
  - performance sliders
  - scheduling controls
  - reset/save footer actions

### UX Continuity

- Kept the page on the same visual baseline as `My Wallet`.
- Reused the same dark/light discipline instead of hard-locking the section to one theme.
- Continued using page-local classes only as a thin layer on top of shared UI primitives.

### Scope Note

- These controls are currently a UI-stage configuration surface.
- They do not introduce a second runtime or a page-local persistence path.
- The next phase can connect them to a shared persisted settings model without redoing the layout.

### Files Updated

- `src/views/BotSettingsView.tsx`
- `src/styles/content.css`

## Shared Select Primitive Fix

### What Changed

- Fixed the combo box/select rendering issue from the shared UI layer instead of only patching `Bot Settings`.
- Added a reusable `ui-input-shell` select variant so future select controls can:
  - place the chevron on the trailing edge
  - keep correct padding
  - inherit dark/light theme correctly

### Why This Matters

- The issue was not specific to `Bot Settings`.
- It was a shared styling gap in the base input primitive.
- Fixing it centrally avoids repeating the same bug on future pages.

### Files Updated

- `src/styles/ui-primitives.css`
- `src/styles/theme.css`
- `src/views/BotSettingsView.tsx`

## Bot Registry Persistence Activation

### What Changed

- Activated the first real bot persistence path instead of keeping `Bot Settings` fully backed by the initial registry seed.
- Added a shared `/api/bots` persistence seam with:
  - `GET /api/bots`
  - `POST /api/bots`
  - `PATCH /api/bots/[id]`
- Moved the shared bot registry runtime into the existing selected-bot seam so:
  - `All Bots`
  - quick edit
  - selected bot context
  - full bot workspace
  all read/write against the same registry state.

### Data Continuity

- The registry now treats local storage only as a warm cache.
- Remote bot payloads are canonical when available, matching the same continuity pattern already used by watchlists.
- `Signal Bot` now prefers the bot's persisted `workspaceSettings.primaryPair` before falling back to feed-derived context.

### Product Continuity

- `Create New Bot` now creates a real persisted bot profile instead of remaining a visual-only CTA.
- quick edit now saves back into the same bot registry seam instead of staying as local drawer state only
- start/pause actions now update the real bot status path

### Files Updated

- `api/_lib/bots.js`
- `api/bots/index.js`
- `api/bots/[id].js`
- `src/domain/bots/contracts.ts`
- `src/domain/bots/defaults.ts`
- `src/domain/bots/registry.ts`
- `src/hooks/useSelectedBot.ts`
- `src/hooks/useSignalsBotsReadModel.ts`
- `src/services/api.ts`
- `src/views/BotSettingsView.tsx`
- `src/views/SignalBotView.tsx`

## First Real Bot Metrics Round

### What Changed

- The first real bot path now stops showing purely empty placeholder performance.
- `Bot Settings` and `Signal Bot` now derive bot-level runtime metrics from the real shared `signalMemory` snapshots already stored for the user.
- The derivation is scoped by each bot's persisted `workspaceSettings.primaryPair`, so the first bot can behave as a real bot profile without waiting for a separate bot-decisions table.

### Data Continuity

- No page-local fetches were added.
- The read path remains:
  - shared signal memory
  - shared ranked feed seam
  - shared persisted bot registry seam
- Bot cards now enrich the registry with:
  - real signal count
  - real closed outcome count
  - real realized PnL from stored snapshots
  - real win rate from stored outcomes

### Files Updated

- `src/hooks/useSignalsBotsReadModel.ts`
- `src/views/BotSettingsView.tsx`

## Product Logic Alignment Round

### What Changed

- Reconciled the local redesign docs with the updated product direction:
  - dual `signals + bots`
  - stronger AI role separation
  - governed overlap
  - watchlist-first signal priority
  - conversational future through structured actions
- Added the next structural step explicitly to the plan:
  - `Phase 3.5 - Bot Decision And Activity Layer`
- Extended the domain contracts with the next entities needed for that phase:
  - `BotDecisionRecord`
  - `BotPerformanceBreakdown`
  - `BotConversationAction`

### Why This Matters

- The repo now already has:
  - a persisted bot registry
  - a selected-bot seam
  - a full bot workspace
- The next true blocker is no longer visual architecture.
- It is the missing bot-owned decision/activity layer that should power:
  - real history
  - real bot performance
  - training
  - future conversational audit

### Files Updated

- `docs/next-signals-bots-ai/current-state.md`
- `docs/next-signals-bots-ai/target-architecture.md`
- `docs/next-signals-bots-ai/domain-model.md`
- `docs/next-signals-bots-ai/implementation-plan.md`
- `src/domain/bots/contracts.ts`

## Bot Decision And Activity Base

### What Changed

- Started `Phase 3.5` with a real bot-owned decision/activity seam.
- Added backend handlers for bot decisions:
  - `GET /api/bot-decisions`
  - `POST /api/bot-decisions`
  - `PATCH /api/bot-decisions/[id]`
- Added a shared runtime hook for bot decisions with warm local cache:
  - `src/hooks/useBotDecisions.ts`
- Updated the shared bots read-model so bot cards can prefer bot-owned decisions over pair-only inference when decisions exist.
- Wired `Signal Bot` actions so the bot can now register real manual decisions from its workspace:
  - observe
  - execute
  - block
- Updated `Execution Logs` so bot decisions can appear in the same monitoring surface as execution orders.

### Why This Matters

- The first bot is no longer limited to fake or pair-derived history only.
- We now have the structural base for:
  - real bot history
  - execution logs per bot
  - performance fed by bot-owned activity
  - future training and audit layers

### Supabase Dependency

- This phase now expects a `bot_decisions` table in Supabase.
- The frontend/runtime degrades safely while the table is missing, but full persistence requires that table.

### Files Updated

- `api/_lib/botDecisions.js`
- `api/bot-decisions/index.js`
- `api/bot-decisions/[id].js`
- `src/services/api.ts`
- `src/hooks/useBotDecisions.ts`
- `src/hooks/useSignalsBotsReadModel.ts`
- `src/views/SignalBotView.tsx`
- `src/views/ExecutionLogsView.tsx`

## Market Core And Signal Core Split

### What Changed

- Started the first concrete `Phase 4` split instead of letting bots keep stretching the old mixed signal module.
- Added two new selector seams:
  - `useMarketCoreSelector`
  - `useSignalCoreSelector`
- Added a shared hook:
  - `src/hooks/useMarketSignalsCore.ts`
- The new shared hook now exposes:
  - market context
  - watchlist feed
  - market-wide feed
  - operable feed
  - bot-consumable subset for the currently selected bot
- Strengthened `operable feed` so it now prefers real eligible `execution candidates` from the shared execution overlay.
- Kept a phase-safe fallback to ranked `signalMemory` when execution candidates are absent, so the current system does not go dark on surfaces that still hydrate only memory.
- Let `bot-consumable` reuse that stronger operable cohort first instead of depending only on ranked memory inference.
- Refactored `SignalsView` to read from that shared market/signal seam.
- Refactored the shared `signals + bots` read-model to consume that seam instead of rebuilding the full feed pipeline by itself.

### Why This Matters

- `Market Core`, `Signal Core`, and `Bot Core` now have a cleaner boundary.
- This keeps us from finishing bots on top of a still-mixed signal module.
- It also clarifies what we are reusing from the old project instead of discarding:
  - market plane context
  - signal memory
  - watchlist scanner
  - ranked feed logic
  - execution-candidate bridge

### Files Updated

- `src/data-platform/selectors.ts`
- `src/domain/signals/feedAdapters.ts`
- `src/hooks/useMarketSignalsCore.ts`
- `src/hooks/useSignalsBotsReadModel.ts`
- `src/views/SignalsView.tsx`
