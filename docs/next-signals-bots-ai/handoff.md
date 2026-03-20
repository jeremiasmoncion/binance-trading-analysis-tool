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

The redesign also now has an explicit UX architecture source of truth under:

- `docs/next-signals-bots-ai/user-experience-architecture.md`

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
- added first dedicated end-user navigation surfaces for:
  - `Signals`
  - `Bots`
- removed the redesign from depending only on the legacy `Signal Bot` page for discoverability
- aligned navigation and dashboard entry points with a more template-like page distribution
- established that "template-like" is no longer sufficient:
  - future UX flow should match the template hierarchy and page logic exactly
- documented the official sidebar, submenu, tab, and page-composition architecture for:
  - `Trading`
  - `Control Panel`
  - `AI Bot`
  - `Signal Bot`
  - `Bot Settings`
  - `Execution Logs`
- documented the rule that end-user surfaces must show only the minimum useful information and translate technical concepts into simpler product language when possible
- verified the new domain layer with `npm run typecheck`

## What Has Not Been Done Yet

- no persistence or shared store has been attached to the new bot registry yet
- no persistence has been attached to the new bot registry yet
- no global shell wiring has been added for the domain module
- no signal feed has been wired into the existing market/runtime pipeline beyond read-only/domain-driven surfaces
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

Continue replacing the legacy product flow with the new user-facing page structure:

- the first registry/store location is now established in `src/domain/bots/registry.ts`
- the first visible user-facing pages now exist for:
  - `Signals`
  - `Bots`
- feed ranking/prioritization is now in place as a read-only layer over published feed
- current hydration source is intentionally:
  - `signal memory snapshots`
- current validated read path is:
  - `signal memory snapshots`
  - -> `published signal feed`
  - -> `ranked published feed`
  - -> `bot-consumable feed`
  - -> user-facing `Signals` surface
- next step should stay focused on:
  - migrating the sidebar and page flow to the exact template hierarchy
  - replacing generic `Signals` / `Bots` interim flow with:
    - `Control Panel`
    - `AI Bot`
    - `Signal Bot`
    - `Bot Settings`
    - `Execution Logs`
  - phasing the old legacy `Signal Bot` implementation out of the visible main user journey
  - keeping registry persistence deferred until the user-facing page architecture is stable

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

## End-User Review Constraint

Future contributors and directors must evaluate UI progress from an end-user review perspective.

This means:

- it is not enough for a surface to exist only as a hidden lab or buried temporary host
- if a UI round is declared review-worthy, the human operator should be able to reach it through a realistic product path
- temporary validation hosts are acceptable during phased delivery, but they should remain easy to find and should move progressively toward real product surfaces
- implementation should always assume that the eventual audience is the final user, not only an internal reviewer who already knows where the experimental host is

Practical consequence:

- do not count a UI round as truly ready for final UX review unless it is discoverable, understandable, and coherent from a normal user flow

The new `Signals` and `Bots` pages are now the correct surfaces to iterate on for end-user review.
That was a transitional step only.

The current official target is now stricter:

- the app should follow the exact `TradeBotX` sidebar and page flow
- future work should iterate toward template-matching destinations, not generic interim pages
- the old `Signal Bot` page should no longer be treated as the primary delivery target for product UX
- technical or admin-heavy information should either be translated or kept out of the main user journey

## Delivery Expectation For Future Directors

When reporting progress or handing off a meaningful integrated lot, future directors should always communicate in two parallel layers:

### 1. User-facing delivery summary

Explain:

- what changed in the app from an end-user point of view
- where the operator can find it
- how it is supposed to be used
- what is still temporary, experimental, or not yet productized

### 2. Technical/orchestration summary

Explain separately:

- what the implementer changed
- what the refiner changed
- what the next step is for each side
- what the next major milestone is for the overall redesign

This rule exists so the project owner can understand both:

- the product value of the current lot
- the architectural direction and the next work split

## Current UX Direction For Future Directors

Future directors should assume the following without reopening the discussion:

- the template flow is the official UX standard
- the sidebar grouping and ordering should match the template
- page nesting should match the template
- user-facing page composition should match the template
- the lower `ACCOUNT` section and bottom user block should also match the template structure
- visible labels, section names, record naming, and user-facing terminology should also default to the template unless a deviation is justified
- the migrated CRYPE graphic line in `Dashboard` and `My Wallet` remains the visual baseline
- `Dashboard` and `My Wallet` are also the implementation reference for how template-faithful visuals should be built using CRYPE's shared CSS architecture
- user-facing modules should show only the minimum useful information first
- technical detail belongs in translated form or in future admin/technical surfaces

Future work should be split like this:

- implementer:
  - exact UX flow migration
  - page/subpage composition
  - user-facing information simplification
  - template-matching layout behavior
- refiner:
  - runtime protection
  - shared-state stability
  - anti-churn work while new surfaces are mounted
  - prevention of page-local fetch/polling or equivalent writes

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

## Refinador Runtime - 2026-03-19 - Execution Center Semantic Stability

### What Was Done

- Hardened `useBinanceData` so `ExecutionCenterPayload` equality is semantic rather than shallow.
- Added cohort-level comparison for execution candidates and recent orders.
- Added semantic comparison for execution profile policy arrays and scope overrides.
- Kept this stability logic in shared runtime infrastructure instead of leaving it to future template components.

### Files Touched

- `src/hooks/useBinanceData.ts`
- `docs/data-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Where This Round Ended

- The shared execution runtime is better prepared for the exact template UX expansion, where more pages and tabs will observe the same payload.
- The next likely stability seam is any remaining hybrid runtime path that still uses shallow equality for larger cohorts outside execution.

### What Remains Pending

- Continue auditing shared hooks for semantic-no-op gaps outside `ExecutionCenterPayload`.
- Check whether scanner or validation cohorts need the same deeper equality guarantees before template expansion reaches them.

### What The Director Should Review

- This round directly protects the upcoming UX migration by moving equality where it belongs: infrastructure, not pages.
- No product-layer feature work was introduced.

### What The Implementer Should Avoid

- Do not solve execution-surface churn with component-level memoization alone.
- Do not add page-local equality logic in new template tabs/cards/tables for execution payloads; reuse the shared runtime seam.

## Refinador Runtime - 2026-03-19 - Template Feed Selector Narrowing

### What Was Done

- Added a dedicated shared selector for `Signals` and `Bots` feed inputs.
- Moved `SignalsView` and `BotsView` away from the broad memory/runtime selector bundle.
- Restricted those template pages to the shared state they actually need:
  - `signalMemory`
  - `watchlists`
  - `activeWatchlistName`

### Files Touched

- `src/data-platform/selectors.ts`
- `src/views/SignalsView.tsx`
- `src/views/BotsView.tsx`
- `docs/data-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Where This Round Ended

- The first template-facing read-only pages are now less exposed to unrelated runtime churn.
- This sets the rule that future pages should widen selectors only when the data contract truly requires it.

### What Remains Pending

- Continue auditing template-facing pages for broad selector usage before more real runtime data is attached.
- Evaluate whether future `Execution Logs` and deeper `Control Panel` tabs should get their own selector seams before they hydrate richer datasets.

### What The Director Should Review

- This round protects the template migration without changing product behavior.
- It keeps selector granularity as shared infrastructure, not page-local optimization.

### What The Implementer Should Avoid

- Do not default new template pages to `useMemorySystemSelector` or other broad selector bundles.
- Do not subscribe a page to scanner/execution/admin state if it only needs feed/watchlist inputs.

## Refinador Runtime - 2026-03-19 - Scanner Runtime Cohort Stability

### What Was Done

- Hardened `useMemoryRuntime` so scanner status equality is semantic instead of shallow.
- Added cohort-level comparison for scanner targets and scanner runs.
- Kept this stability rule in shared runtime infrastructure so future template pages do not need page-local churn workarounds.

### Files Touched

- `src/hooks/useMemoryRuntime.ts`
- `docs/data-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Where This Round Ended

- Scanner/runtime state is better prepared for denser `Control Panel` and `Execution Logs` surfaces.
- The remaining risk pattern is any other shared comparator that still relies on shallow array checks while future template pages plan to observe richer cohorts.

### What Remains Pending

- Continue auditing shared runtime comparators for shallow cohort checks.
- Revisit validation/runtime reporting paths before those surfaces gain more real operational density.

### What The Director Should Review

- This round closes another infrastructure seam before the template pages attach heavier live/admin content.
- No product-layer behavior changed.

### What The Implementer Should Avoid

- Do not fix scanner/runtime page churn with component-level memoization or local equality guards.
- Reuse the shared comparator seam if new template pages read scanner history or operational runs.

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

## Implementador - 2026-03-19 - Template Flow Migration

### What Was Done

- Replaced the visible navigation flow with the template hierarchy approved by direction.
- Moved the first visible product surfaces away from generic `Signals` / `Bots` destinations and into:
  - `Control Panel -> Overview`
  - `Control Panel -> Bot Settings`
  - `Control Panel -> Execution Logs`
  - `AI Bot -> Signal Bot`
- Added placeholder routes for the remaining template sections so the sidebar and page tree are already correct.
- Implemented the new pages with CRYPE's shared visual architecture instead of copying template CSS literally.

### Files Touched

- `src/types.ts`
- `src/components/Sidebar.tsx`
- `src/components/AppView.tsx`
- `src/views/DashboardView.tsx`
- `src/views/ControlOverviewView.tsx`
- `src/views/BotSettingsView.tsx`
- `src/views/ExecutionLogsView.tsx`
- `src/views/SignalBotView.tsx`
- `src/views/TemplatePlaceholderView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### What Was Reused

- `src/domain/` ranking and bot-feed logic
- `signal memory` snapshots as the shared read source
- shared selectors and existing CRYPE tokens/components
- visual implementation patterns from `Dashboard` and `My Wallet`

### Where This Round Ended

- The app no longer depends on generic `Signals` and `Bots` as the visible UX target for this initiative.
- The sidebar and first user-facing pages now follow the template architecture much more literally.
- The visible flow is correct even where content is still placeholder.

### What Remains Pending

- Make the new pages even more literal where the template expects richer controls and fuller subpage content.
- Decide whether transitional files like `SignalsView`, `BotsView`, and `ControlPanelView` should now be removed or kept only as internal legacy artifacts.
- Fill remaining placeholder routes in later rounds if direction opens those product phases.

### What The Director Should Review

- Whether the new `Control Panel` and `AI Bot` surfaces are now sufficiently aligned to the template for preview/integration review.
- Whether direction wants the next round to deepen fidelity inside these new pages or begin removing transitional legacy views from the visible code path.

### Sensitive Areas Avoided

- `src/App.tsx`
- `src/data-platform/*`
- `src/realtime-core/*`
- hooks sensibles
- `api/_lib/*`

## Implementador - 2026-03-19 - Signal Bot Page Closure Pass

### What Was Done

- Closed a much fuller version of `AI Bot -> Signal Bot` as the first page-specific closure pass.
- Moved the page to the narrower existing selector:
  - `useSignalsBotsFeedSelector`
- Kept the page away from the broader memory bundle.
- Strengthened `Active Signals` into the dominant subview with:
  - real chips/filters
  - stronger cards
  - clearer entry/target/stop hierarchy
  - visible actions
- Deepened `Signal History` into a denser table aligned to the template naming.
- Expanded `Performance` with a more user-readable summary.
- Simplified `Bot Settings` to user-facing essentials only.
- Added the lower template blocks:
  - `Market Sentiment`
  - `AI Insights`
  - `Top Signal Performers`

### Files Touched

- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### What Was Reused

- ranked feed and high-confidence logic from `src/domain/`
- bot-consumable feed derivation
- signal memory snapshots as the approved read source
- shared CRYPE style system

### Where This Round Ended

- `Signal Bot` is now the strongest page in the new template flow.
- The page reads closer to a real product page than to an intermediate scaffold.
- The page also respects the new selector discipline instead of overreading broader screen bundles.

### What Remains Pending

- If direction wants, later rounds can still add:
  - richer interactions
  - drawers
  - more detailed exports
  - more dynamic filters
- But the page is now strong enough to serve as the reference closure standard for the next pages.

### What The Director Should Review

- Whether `Signal Bot` now sets the quality bar for the next page-by-page closure rounds.
- Whether the next page should be `Control Panel -> Overview` or `Execution Logs`.

### Coordination Note For Refinador

- No runtime wiring or new per-screen fetch/polling was introduced.
- The new pages continue to read from existing shared selectors and local domain adapters only.

## Implementador - 2026-03-19 - Template Naming And Account Sidebar Pass

### What Was Done

- Completed the template account section in the sidebar.
- Integrated the user block and logout into the account/user pattern instead of leaving logout as a detached control.
- Added the missing `Bot Templates` item under `Marketplace`.
- Tightened visible language to match the template more literally across:
  - tabs
  - labels
  - column names
  - status names
  - action labels
- Deepened the live content of:
  - `Control Panel -> Overview`
  - `Control Panel -> Bot Settings`
  - `Control Panel -> Execution Logs`
  - `AI Bot -> Signal Bot`

### Files Touched

- `src/types.ts`
- `src/components/Sidebar.tsx`
- `src/components/AppView.tsx`
- `src/views/ControlOverviewView.tsx`
- `src/views/BotSettingsView.tsx`
- `src/views/ExecutionLogsView.tsx`
- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `src/styles/layout.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### What Was Reused

- shared selectors and data planes already in the repo
- domain ranking and bot feed logic under `src/domain/`
- CRYPE visual primitives and layout conventions already proven in `Dashboard` and `My Wallet`

### Where This Round Ended

- The sidebar now mirrors the template more completely, including the lower account zone.
- The user-facing pages now speak much closer to the template's product language.
- The first opened template pages are no longer just structural placeholders; they now have deeper, more page-specific content.

### What Remains Pending

- Placeholder routes still need real content in later phases.
- Some transitional views remain in the codebase even though they are no longer the intended UX target.
- Additional depth is still possible in later rounds for drawers, richer controls, and more literal page behaviors.

### What The Director Should Review

- Whether the new naming layer is now close enough to the template for preview review.
- Whether the next round should deepen the already-open pages again or start removing transitional legacy views from the visible app path.

### Sensitive Areas Avoided

- `src/App.tsx`
- `src/data-platform/*`
- `src/realtime-core/*`
- hooks sensibles
- `api/_lib/*`
