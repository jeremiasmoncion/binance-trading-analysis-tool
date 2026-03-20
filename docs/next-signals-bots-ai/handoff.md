# Handoff

## Current Status

The project now has a dedicated documentation base for the redesign of CRYPE into a `signals + bots + AI` platform.

The active working brief for the current round is now explicit in the documentation set:

- continue on `main`
- resume from the current `Bot Core` state
- preserve the current CRYPE base and shared seams
- avoid screen-local fetch/polling/runtime fixes when a shared path already exists
- advance by phases with documentation, handoff updates, and functional deliverables

The current product/engineering focus remains:

- deepen `Bot Core` over the cleaner `Signal Core`
- close real bot identity, policy, memory, activity/history, performance, and missing persisted settings
- strengthen the bridge between consumed signals and bot decisions

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

The redesign also now has dedicated documentation for:

- product/business operating model
- visual/style architecture
- single-AI onboarding/context pack

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
- added a shared `signals + bots` read-model seam so template-facing pages can reuse one ranked-feed derivation path
- narrowed `Control Panel -> Overview`, `Bot Settings` and `Execution Logs` away from the broader memory/runtime selector bundle when they only needed smaller shared slices
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
- added a dedicated style architecture document explaining how CRYPE should match the template visually while using CRYPE's shared CSS architecture
- added a dedicated product operating model document explaining the agreed business/product logic of `signals + bots + AI`
- added a dedicated AI context pack so a single new AI can onboard into the whole project quickly without relying on thread memory
- verified the new domain layer with `npm run typecheck`
- moved `API Connections` out of `Bot Settings` and into the account/security module where exchange credentials actually belong
- expanded `ProfileView` into a real settings hub for:
  - account
  - notifications
  - Binance
  - security / API keys
- replaced fake API connection cards in the account area with the real Binance Demo connection already owned by the current user session
- kept account-level preferences local/persisted without opening a second bot/platform settings runtime

## What Has Not Been Done Yet

- the first bot registry persistence seam now exists, and `General Settings`, `Risk Management`, and `Notifications` now persist through it, but deeper policy editing is still pending across identity / universe / style / timeframe / execution controls
- the first real bot now derives runtime card/workspace metrics from persisted signal snapshots through the shared read-model seam, and the bot-decision API/runtime seam now also syncs memory/performance/activity back into the bot profile, but the dedicated Supabase `bot_decisions` table still remains pending
- the next recommended phase is now explicit: `Phase 3.5 - Bot Decision And Activity Layer`
- no global shell wiring has been added for the domain module
- no signal feed has been wired into the existing market/runtime pipeline beyond read-only/domain-driven surfaces
- no AI conversational layer has been implemented yet
- the account/settings module now has a stronger UX and real Binance wiring, but deeper user-profile persistence still remains intentionally limited to local preferences plus the existing Binance connection seam

## Phase 3.5 Status

- done:
  - `BotDecisionRecord` exists in the domain contracts
  - `/api/bot-decisions` exists as a shared persistence seam
  - `useBotDecisions` exists as a shared runtime hook
  - `Signal Bot` can register manual bot decisions from the workspace
  - `Execution Logs` can already consume bot decisions alongside execution orders
  - `General Settings` now persist against the selected bot profile
  - `Risk Management` now persists against the selected bot profile
  - `Notifications` now persist against the selected bot profile
  - `General Settings` now also persists a deeper bot policy envelope:
    - identity family / owner scope / operating profile
    - execution environment
    - automation mode
    - universe policy
    - styles
    - timeframes
    - execution overlap / arbitration mode
    - key AI / execution toggles
  - the persisted bot contract now preserves:
    - identity
    - notification settings
    - audit
    - activity
  - bot decisions now sync real bot-owned runtime summaries back into the bot profile:
    - local memory
    - performance
    - audit timestamps
    - recent activity
  - the shared `signals + bots` read-model now exposes a richer bot-owned activity layer from decisions:
    - per-bot decision timeline
    - richer performance breakdowns by origin / symbol / timeframe / strategy / market context
  - `Signal Bot` and `Execution Logs` now consume that richer activity layer instead of relying only on raw decision rows
  - the shared bot read-model now also derives layered bot memory boundaries:
    - local
    - family
    - global
  - `Signal Bot` now exposes that layered memory separation in the bot performance workspace
  - bot registry hydration no longer reuses the 5-bot template catalog as a fake user registry fallback
  - stale local bot cache now ignores template-only registries
  - stale local bot cache now also ignores malformed pre-contract bot registries that are missing current bot runtime fields
  - `Bot Settings` now renders explicit loading / empty / error states when the persisted registry is unavailable instead of showing template bots
  - `Create New Bot` now opens a local quick-edit draft first and only persists the bot when the user confirms with `Save Changes`
  - the shared bot read-model now aligns with the explicit `BotPerformanceBreakdown` contract instead of only generic UI buckets
  - `Signal Bot -> Performance` now exposes richer bot-owned slices by strategy/origin/timeframe/symbol
  - persisted bot decisions can now enrich themselves with linked execution outcomes from the shared execution plane
  - decision metadata can now carry stronger outcome linkage:
    - `executionOrderId`
    - execution status / outcome status
    - linked pnl / notional / quantity / hold minutes
    - linkage reason
  - `Execution Logs` now surfaces that decision-side execution linkage more clearly
  - the shared bot read-model now exposes a bot-owned activity timeline that folds linked decisions and linked executions into one shared history shape
  - decision timeline entries now also expose explicit execution linkage metadata directly from the shared seam:
    - `executionOrderId`
    - execution status / outcome status
    - execution linked timestamp
    - linkage reason
  - `Execution Logs` now prefers that shared activity timeline so linked decision + execution pairs are not shown as two unrelated stories
  - `Execution Logs` toolbar is now functional on top of that shared activity layer:
    - real search by id / pair / bot / source
    - ownership filters for linked outcomes, decision-only rows, and unlinked orders
    - empty state when no activity matches the current view
  - `Signal Bot` history now reads the same owned activity shape instead of locally reconstructing decision/execution overlap
  - bot memory layers now derive from owned activity + owned outcomes instead of mostly flat decision totals
  - local, family, and global memory now track:
    - activity count
    - decision count
    - owned outcome count
    - unresolved decision count
    - unlinked execution count
  - `Signal Bot -> Memory Layers` now emphasizes owned outcomes at the UI level while still keeping notes from the shared seam
  - execution ownership matching is now hardened with stronger existing bridges instead of only light heuristic overlap:
    - persisted `executionOrderId`
    - shared market-context signature
    - controlled observed-time vs execution-time proximity
  - that hardening now exists in both:
    - the decision outcome sync seam
    - the shared bot read-model ownership resolver
  - `executionOrderId` now also counts as a direct ownership match, not only `signal_id`
  - the shared bot summary now also tracks ownership health across the fleet:
    - total owned outcomes
    - unresolved ownership backlog
  - each bot card now exposes ownership health directly in `Bot Settings`:
    - owned outcomes
    - needs-link count
    - reconciliation percentage
  - `Signal Bot` now also exposes ownership health for the selected bot directly inside the workspace:
    - reconciled activity percentage
    - unresolved linkage backlog
    - owned outcomes count
  - the selected bot settings surface now repeats that ownership health in simplified form so the workspace remains self-explanatory
  - ownership health now also exposes stronger qualitative indicators for the selected bot:
    - owned outcome rate
    - unresolved rate
    - health label (`healthy`, `stable`, `watch`, `needs-attention`)
  - the selected bot workspace now also exposes a first owned-outcome adaptation summary:
    - training confidence
    - strongest learned edge
    - weakest pocket
    - adaptive bias
  - when ownership health falls into `watch` or `needs-attention`, `Signal Bot` now exposes a compact drill-down for:
    - leading backlog type
    - top unresolved decision symbols
    - top unlinked execution symbols
  - the bot hub now also exposes fleet-level adaptation readiness:
    - learning-ready bot count
    - high / medium / low adaptation-confidence counts
  - bot cards now include compact adaptation cues so the hub can show which bots are actually learning from owned outcomes
  - `Bot Settings` now also includes a compact weakest-bots attention list driven by:
    - unresolved ownership count
    - reconciliation percentage
    - adaptation confidence
  - bot-attention scoring now lives in the shared bot read-model instead of being recomputed separately inside each surface
  - the shared seam now exposes:
    - `attentionBots` for compact fleet-level display
    - `attentionBotIds` for operational filtering
  - `Execution Logs` now supports a bot-priority scope on top of the shared activity stream:
    - all bots
    - attention bots
  - `Bot Settings` weakest-bots panel now reuses the same shared ranked attention list instead of rebuilding a second local top-3
  - `Execution Logs` now also exposes compact per-bot summaries above the table for the current scope
  - those summaries now reflect the same active filters and expose, per bot:
    - activity count in view
    - linked decisions
    - decision-only rows
    - unlinked orders
    - owned outcomes
    - unresolved ownership backlog
    - ownership health
    - adaptation confidence
  - prioritized execution summaries now also surface more actionable pockets per bot:
    - unresolved decision symbols
    - unlinked execution symbols
    - best pocket symbol
    - weak pocket symbol
  - prioritized execution summaries now rank recurring backlog symbols per bot instead of only listing them flat:
    - unresolved decision rankings
    - unlinked execution rankings
  - `Bot Settings` weakest-bots panel now also surfaces the same diagnostic language as the execution summaries:
    - unresolved decision symbols
    - unlinked execution symbols
    - best pocket symbol
    - weak pocket symbol
  - recurring backlog symbol ranking now also lives in the shared ownership seam:
    - unresolved decision rankings
    - unlinked execution rankings
  - `Bot Settings` weakest-bots panel now consumes those rankings instead of flat symbol lists
  - the first shared operational bot loop now exists at app level:
    - active bots can consume accepted signals automatically
    - active bots can persist bot-owned decisions automatically
  - the loop is policy-governed by automation mode and execution policy:
    - `observe` -> auto observation decision
    - `assist` -> auto assisted decision
    - `auto` -> auto execution-intent decision only when policy truly allows self-execution
  - when execution policy is not fully open, `auto` bots now fall back to assisted decisions instead of pretending real execution happened
  - this round stops at `signal -> bot decision`; it does not yet emit direct execution orders from the bot runtime
  - the operational loop now also applies first real bot-level guardrails before escalating toward execution intent:
    - available capital
    - max open positions
    - symbol exposure
    - execution overlap policy
  - guardrail violations now persist as bot-owned blocked decisions instead of silently disappearing
  - operational decision metadata now includes first execution-intent fields:
    - requested notional
    - open position count
    - same-symbol open count
    - projected symbol exposure
    - guardrail code / reason
  - the shared bot read-model now also exposes explicit execution-intent summaries per bot:
    - ready intents
    - approval-needed intents
    - assist-only intents
    - observe-only intents
    - guardrail-blocked intents
  - `Signal Bot` now exposes that execution-intent layer directly in the selected bot workspace:
    - latest intent status
    - latest guardrail reason
    - top ready symbols
    - top blocked symbols
  - the operational loop now also normalizes generated decisions into an explicit paper/demo execution-intent lane inside the shared decision seam:
    - lane
    - lane status
    - queued timestamp
    - paper/demo readiness
    - approval requirement
  - linked execution outcomes now also close that same lane into `linked` instead of leaving the intent state ambiguous
  - `Signal Bot` now exposes queue-level intent lane state directly for the selected bot:
    - queued intents
    - awaiting approval
    - linked intents
    - latest lane state
  - the shared decision timeline now also carries execution-intent lane metadata directly into `Execution Logs`
  - `Execution Logs` now supports intent-review scopes on top of the shared activity seam:
    - queued intents
    - awaiting approval
    - blocked intents
    - linked intents
  - `Execution Logs` now also shows compact per-bot paper/demo intent backlog summaries:
    - queued
    - awaiting approval
    - blocked
    - linked
    - top ready symbols
    - top blocked symbols
  - `Execution Logs` now also supports explicit review actions for intents waiting on approval:
    - approve -> move back to `queued`
    - reject -> move to `blocked`
  - approval/rejection stays inside the same shared bot-decision seam; no second runtime or side queue was introduced
  - queued paper/demo intents can now also move into an explicit `dispatch-requested` lane from `Execution Logs`
  - this keeps dispatch distinct from both:
    - approval
    - linked execution outcome
  - the shared operational loop now also consumes that `dispatch-requested` lane through the existing shared execution adapter:
    - `paper -> preview`
    - `demo -> execute`
  - successful adapter calls now split into clearer paper/demo terminal states instead of sharing one generic `dispatched` lane:
    - `paper -> previewed`
    - `demo -> execution-submitted`
  - when the execution plane confirms a preview record, the paper path now closes into:
    - `preview-recorded`
  - preview-confirmed decisions now also update dispatch-status semantics explicitly instead of leaving stale generic dispatch metadata behind
  - failed adapter calls now move the same decision into `blocked` with explicit dispatch reason metadata
  - the lane normalizer now preserves progressed ready intents instead of snapping:
    - `dispatch-requested -> queued`
    - `previewed -> queued`
    - `execution-submitted -> queued`
  - the shared decision timeline now also exposes dispatch diagnostics directly:
    - dispatch mode
    - dispatch status
    - attempted timestamp
    - dispatched timestamp
  - blocked intent rows now also surface the shared intent reason more directly during execution review
  - intent summaries now also count and prioritize dispatch backlog instead of treating it as hidden queue state
  - `Signal Bot` and `Execution Logs` now expose those paper/demo terminal states directly
  - `Execution Logs` and `Signal Bot` now also surface the latest dispatch mode/status instead of treating dispatch as a black box label
  - shared owned-memory notes now also treat `preview-recorded` as a closed paper-preview artifact instead of describing it as unresolved execution linkage
  - shared intent summaries now also track freshness inside the paper-preview closure path:
    - `previewFreshCount`
    - `previewStaleCount`
  - current heuristic:
    - `preview-recorded` becomes stale after 6 hours without further progress
  - `memoryPolicy` now exists in the bot contract and persistence seam so shared learning is governable instead of implicit
  - `Bot Settings -> General Settings` now also persists shared-learning governance:
    - family sharing
    - global learning
    - promotion to shared memory
    - approval requirement
    - family scope
  - family/global memory derivation now respects those memory-policy toggles
  - execution orders from the shared execution plane now resolve back into the shared bot read-model:
    - cross-bot execution timeline
    - per-bot execution timeline
    - per-bot execution breakdowns
    - stronger bot label resolution in `Execution Logs`
  - `Signal Bot` now shows owned execution outcomes in bot history/performance instead of only decision-level history
  - bot performance can now prefer linked execution outcomes when they exist
- next:
  - create the Supabase `bot_decisions` table
  - deepen performance/training off the owned activity and owned memory layers with stronger contracts
  - add richer per-bot outcome summaries on top of the now-prioritized `Execution Logs`
  - evaluate whether any owned-outcome/adaptation summaries now deserve persistence or indexed storage support
  - keep tightening recurring unresolved symbols surfaced by the shared attention scope
  - decide whether recurring unresolved-symbol pockets should now surface directly in the prioritized execution summaries
  - decide whether recurring pocket rankings now deserve persistence or fleet-level promotion
  - evaluate whether recurring symbol rankings should feed stronger ownership diagnostics for the worst bots
  - decide whether the fleet hub should also surface ranked recurring symbols instead of only flat backlog symbol lists
  - evaluate whether weakest-bot cards should deep-link into filtered execution-log context
  - decide whether dispatch backlog should surface more clearly in fleet-level summaries
  - decide whether those terminal dispatch states now need richer adapter-level diagnostics per row and per bot
  - decide whether `preview-recorded` now needs a user-facing closure/expiry model distinct from demo execution progress
  - keep direct order emission out of scope until the execution-intent lane is governed end-to-end

## Phase 4 Status

- done:
  - first shared `market + signal core` seam exists
  - market context is now isolated from signal feed derivation in a reusable hook
  - the signal core now exposes explicit feed subsets for:
    - watchlist
    - market-wide
    - operable
    - bot-consumable
  - `operable` now prefers eligible `execution candidates` from the shared execution overlay
  - `bot-consumable` now reuses that stronger operable cohort before falling back to ranked memory feeds
  - scanner discovery context now travels in the same seam:
    - active watchlist
    - watched coins
    - latest scan freshness
    - latest scan signal creation counts
  - explicit operational cohorts now travel in the same seam:
    - eligible execution candidates
    - blocked execution candidates
    - observational ranked signals
  - explicit informational and AI-prioritized ranked subsets now also travel in the same seam
  - AI-prioritized now reuses real adaptive/scorer metadata preserved from `signalMemory`, not only ranking boosts
  - market-wide and operable now also expose scanner/runtime context:
    - discovery feed source
    - latest scan source
    - scheduler evidence
    - cooldown state
    - auto-order counters
    - eligible/blocked cohort averages
  - the shared `signals + bots` read-model now builds bot-facing feeds from the explicit signal taxonomy
    instead of relying on the broad ranked feed as the primary bot input
  - `Signal Bot` now maps decision layers with real adaptive/execution metadata first
  - `Signal Core` now exposes one explicit taxonomy contract for:
    - informational
    - observational
    - operable
    - AI-prioritized
  - `SignalsView` and the shared `signals + bots` read-model now reuse that seam
- reuse anchor:
  - market plane active opportunity context
  - signal memory
  - watchlist scanner
  - ranked feed logic already under `src/domain/signals/`
  - execution candidates are now the first live bridge for deeper operable feeds
- next:
  - return to `Bot Core` with the cleaner signal taxonomy as the shared input layer
  - deepen bot identity, policy, memory, and decision ownership on top of that closed signal contract

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

Immediate next step:

- resume `Bot Core` now that account/security/API ownership has been moved out of the bot surface
- focus on:
  - notifications persistence strategy if it must become backend-owned later
  - bot memory / activity / performance
  - cleaner bot identity and policy controls
- feed ranking/prioritization is now in place as a read-only layer over published feed
- current hydration source is intentionally:
  - `signal memory snapshots`
- current validated read path is:
  - `signal memory snapshots`
  - -> `published signal feed`
  - -> `ranked published feed`
  - -> `bot-consumable feed`
  - -> shared `signals + bots` read-model seam
  - -> user-facing template pages
- `Bot Settings -> General Settings` and `Bot Settings -> Risk Management` now share the same form/control implementation baseline:
- `Bot Settings -> Notifications` now follows that same baseline as well:
- `Bot Settings -> API Connections` now follows that same baseline too:
  - shared input/select shells
  - shared toggle treatment
  - shared channel/action rows
  - shared exchange/security cards
  - shared bottom action row
  - shared theme-parity handling
- `Bot Settings -> All Bots` now also includes an in-context quick-edit drawer from each bot card gear action
- that quick-edit surface should remain:
  - contextual
  - right-sided
  - visually inside the same `Bot Settings` family
  - built from the same shared field/toggle/button primitives
- active tab highlighting is now a shared theme rule, not a per-page fix
- future tabbed surfaces should rely on the shared `ui-chip.active` behavior for selected-state persistence across themes
- the system loading dock now uses a branded animated `C` mark instead of a generic spinner
- future global loading surfaces should first confirm whether they belong to `StartupOverlay` or `SystemUiHost`
- the startup session-restore screen should not render a static `C` in the mark slot; it should use a real loading animation there
- `Bot Settings -> All Bots` now has two depths:
  - gear button = quick settings drawer
  - full bot open = navigate to the full bot workspace
- the current full bot workspace is routed through `Signal Bot`, which now reads the selected bot from a shared seam instead of assuming only the default signal bot
- the implementation rule is now explicit:
  - new settings tabs should extend the same shared form primitives
  - they should not reintroduce page-local form styling or theme-specific hacks
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

## Branch And Review Delivery Rule

Future AI contributors should preserve this operating rule:

- `main` is the active development branch and should hold the validated current work
- after completing a scoped task and verifying it locally, save/commit that work in `main`
- `codex` is not the default place to leave current development; it is reserved for explicit human-requested checkpoints
- do not deploy to Vercel automatically after every completed task
- for logic/runtime/architecture work, deploy to Vercel only when the human explicitly asks to review the changes in the browser
- for primarily visual work, a review deployment/link may be provided after validation because visual review is part of the deliverable
- if the human explicitly asks for the link, provide it even if the task was mainly logical
- only then provide the production/deployment link
- when a review link is requested, the canonical public URL is:
  - `https://binance-trading-analysis-tool.vercel.app`
- deployment-specific Vercel URLs are secondary and should be treated as supporting detail unless the human asks for them specifically

This rule exists to keep:

- branch ownership predictable
- production review intentional
- checkpoint branches separate from everyday development flow

## Task Close-Out Rule

Future contributors should close each completed task or subphase with all of the following, not only code changes:

- update the relevant documentation
- update `work-log.md` when a meaningful subphase closes
- update `handoff.md` with current status and next phase context
- if the task changed the application, validate that:
  - code validation still passes
  - build still passes
  - the application still runs and behaves correctly
- if the validation is healthy, save the result in `main`, commit it, and push the milestone when appropriate
- explain clearly to the human operator what was changed
- keep the close-out concise
- prefer two short summaries:
  - a simple end-user/product-flow summary
  - a short technical summary
- explain any important validation, limitation, or residual risk
- state explicitly what the AI believes should be the next recommended step

Default human-facing close-out behavior:

- for logic/runtime/architecture work:
  - explain the result
  - do not send the production link unless the human asked for browser review
- for primarily visual work:
  - explain the result
  - include the production review link when browser inspection is part of acceptance

Canonical public review URL:

- `https://binance-trading-analysis-tool.vercel.app`

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

## Single-AI Onboarding Rule

If a future phase is handled by a single AI instead of separate director/implementer/refiner threads, that AI should treat the following as the minimum operating context:

- `docs/data-architecture.md`
- `docs/realtime-core-service.md`
- `docs/next-signals-bots-ai/product-operating-model.md`
- `docs/next-signals-bots-ai/style-architecture.md`
- `docs/next-signals-bots-ai/user-experience-architecture.md`
- `docs/next-signals-bots-ai/implementation-plan.md`
- `docs/next-signals-bots-ai/ai-context-pack.md`
- `docs/next-signals-bots-ai/handoff.md`

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

## Refinador Runtime - 2026-03-19 - Signal Bot Active Watchlist Narrowing

### What Was Done

- Narrowed the shared selector used by `SignalsView` and `BotsView` so they now observe only:
  - `signalMemory`
  - `activeWatchlistName`
  - `activeWatchlistCoins`
- Removed the dependency on the full watchlist collection for these pages.
- Added selector-level equality so non-active watchlist edits do not wake the Signal Bot feed surface.

### Files Touched

- `src/data-platform/selectors.ts`
- `src/views/SignalsView.tsx`
- `src/views/BotsView.tsx`
- `docs/data-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Where This Round Ended

- `Signal Bot` now has a narrower feed seam before it grows denser cards/tables/filters.
- The page should only wake when the active feed or active list context changes, not when some other watchlist is edited elsewhere.

### What Remains Pending

- Continue auditing Signal Bot seams as more real content lands.
- Revisit whether feed/ranking derivation needs its own shared memo seam once the page has more tabs and summaries.

### What The Director Should Review

- This round is directly targeted at the first full page being closed: `AI Bot -> Signal Bot`.
- No product behavior changed; it is purely runtime protection.

### What The Implementer Should Avoid

- Do not resubscribe Signal Bot to the full watchlist collection by convenience.
- Do not compensate future watchlist-driven churn with local memoization inside Signal Bot components.

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

## Latest Bot Settings Round

### Outcome

- `Control Panel -> Bot Settings` now behaves more like the intended product hub and less like a generic placeholder.
- The page now uses:
  - shared bot summary data
  - a stronger bot card grid
  - platform-level sections for settings, risk, notifications, and API connections

### Architecture Notes

- No per-page fetch path was introduced.
- The page still consumes the shared signals/bots seam.
- The seam was extended with bot summary aggregates instead of pushing more wide derivations into the component.

### Product Notes

- The initial bot registry now includes the broader bot family needed by the UX flow:
  - Signal
  - DCA
  - Arbitrage
  - Pump Screener
  - isolated AI lab
- Dedicated settings navigation now routes to the matching bot surface when that surface already exists.

### Next Likely Step

- Open the dedicated per-bot settings pages so the gear/settings actions stop terminating in placeholders for the non-signal bots.

## Latest General Settings Round

### Outcome

- `General Settings` inside `Bot Settings` now behaves like a real configuration page instead of a compact summary section.
- The tab now includes:
  - select-style trading preferences
  - automation switches
  - performance tuning sliders
  - schedule/time/day controls
  - reset/save actions

### Important Note

- This round is visual + interaction scaffolding only.
- It does not persist settings yet.
- No new fetch path or isolated settings runtime was introduced.

## Shared Select Styling Note

- A select/combo-box rendering bug was fixed in the shared input primitive, not just inside `Bot Settings`.
- Future pages should reuse that shared select variant instead of introducing local combo-box fixes again.

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

## Implementador - 2026-03-19 - Signal Bot Literal Fidelity Pass

### What Was Done

- Pushed `Signal Bot` closer to the template visually in a more literal way.
- Reworked the top stats into page-specific cards with stronger hierarchy and badge treatment.
- Rebuilt `Active Signals` with stronger internal proportions for:
  - entry
  - target
  - stop loss
  - confidence
  - actions
- Kept `Signal History` in a denser template-shaped table.
- Strengthened:
  - `Market Sentiment`
  - `AI Insights`
  - `Top Signal Performers`
  as more complete lower modules.

### Functional Improvement

- Kept the page on `useSignalsBotsFeedSelector` instead of reverting to a larger selector bundle.
- Continued to use real derived domain data for:
  - ranked signals
  - high-confidence
  - policy-approved signals
  - history rows
  - performers
  - side summaries

### What Was Simplified For The User

- Continued translating ranking and policy mechanics into friendlier page language.
- Avoided exposing raw internal system detail unless it improved user decisions.
- Kept the in-page `Bot Settings` section minimal and understandable.

### Files Touched

- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Where This Round Ended

- `Signal Bot` is now closer to a near-closed product page.
- The page has a stronger claim to being the visual and functional benchmark for the next closure rounds.

### What Remains Pending

- If direction wants absolute final polish later, remaining work would mostly be:
  - micro-interaction refinement
  - drawer behavior
  - export behavior
  - final spacing polish against preview review
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

## Implementador - 2026-03-20 - API Connections Relocation

### What Was Done

- Removed `API Connections` from `Control Panel -> Bot Settings`.
- Routed `security-api-keys` into `ProfileView` instead of leaving it as a placeholder route.
- Added a real `security` tab inside `ProfileView` and moved the exchange/API security surface there.

### Why This Was Correct

- API credentials belong to the account/security surface, not the bot-management surface.
- Bots can consume exchange connectivity, but they should not own the credential-management UX.
- This keeps `Bot Settings` focused on bot policy, risk, notifications, and fleet management.

### Files Touched

- `src/components/AppView.tsx`
- `src/views/ProfileView.tsx`
- `src/views/BotSettingsView.tsx`
- `docs/next-signals-bots-ai/user-experience-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### What To Review

- `Control Panel -> Bot Settings` should no longer show an `API Connections` tab.
- `Security & API Keys` in the account area should now display the exchange connection cards and security practices.

## Implementador - 2026-03-20 - Account Tab Template Alignment

### What Was Done

- Rebuilt the `Cuenta` tab layout inside `ProfileView` so it follows the template account screen more closely.
- Kept the account page in four cards instead of one mixed admin/settings block.
- Removed the runtime/admin card from the account tab and left the surface focused on actual account settings.

### Why This Was Correct

- The template expects the account area to feel like a clean settings page, not a backend observability surface.
- This keeps the visual architecture closer to the model page without losing the live settings behavior already wired in.

### Files Touched

- `src/views/ProfileView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### What To Review

- `Cuenta` should now feel much closer to the template composition.
- The top-left card should read as a profile/settings card with an inline edit action, not as a generic admin panel.

## Implementador - 2026-03-20 - Account Header Simplification

### What Was Done

- Removed the top summary block that sat above the account tabs.
- Hid the standalone `Binance` tab from the account settings surface.
- Mapped any legacy `binance` entry point into `Security & API Keys`.
- Swapped the old account tabs bar for the same tab primitive used by `Bot Settings`.

### Why This Was Correct

- The summary strip added extra admin density before the actual settings UI.
- Binance/API connectivity already has a more correct home in `Security & API Keys`.
- This makes the account area read more like the template and more like the existing wallet/bot-settings tab treatment.

### Files Touched

- `src/views/ProfileView.tsx`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### What To Review

- The account page should now open directly into the tab surface without the upper summary band.
- `Binance` should no longer appear as a visible tab.
- The tabs should now look like the same family used in `Bot Settings`, not like the older generic `ModuleTabs`.
