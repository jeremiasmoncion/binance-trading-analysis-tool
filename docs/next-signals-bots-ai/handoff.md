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
- validate multi-bot safe-lane behavior before claiming bots are operational inside `paper/demo`

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

## Reporting Rule

From this point forward, every task close-out should also include a progress estimate expressed as a percentage from `1` to `100` describing how much is still missing to finish:

- the current phase
- or the current core/workstream being deepened

That percentage should appear in the final report alongside:

- what was done
- what should be done next

The estimate does not need to claim absolute certainty, but it should make the remaining distance explicit relative to the current target state for the phase/core.

## What Has Been Done

- removed the selected-bot history truncation that was limiting `Signal Bot -> Signal History` to only the latest 12 entries from the shared bot timeline
- `Signal Bot` now consumes the full selected-bot activity history from the shared read-model seam instead of a pre-trimmed slice
- added pagination to `Signal History` so the selected bot can expose its full operation history without degrading the workspace into one long unbounded table
- fixed selected-bot scope resolution for `watchlist` / `hybrid` bots so the shared read-model no longer collapses watchlist-driven scope down to explicit `symbols` or only the primary pair
- `Signal Bot -> Active Trading Pairs` now reflects active watchlist scope for watchlist-driven bots instead of implying the bot lost coins when only `universePolicy.symbols` was sparse
- moved `Signal History` visually closer to the template with real pair chips and clearer pair/type/status rendering while keeping the data sourced from the shared bot timeline
- normalized `Signal History` rows into a more trade-like history shape so the selected-bot table no longer branches directly on several raw timeline entry variants in the JSX
- added real `All / Buy / Sell` filtering on top of that normalized history model so the selected-bot history behaves more like the template while staying tied to real bot-owned data
- narrowed `Signal Bot -> Signal History` down to closed trade outcomes only so the end-user history no longer surfaces blocked/runtime-only events
- aligned that history toward the template by making the `Type` column show `BUY / SELL` and by preserving outcome-focused statuses such as `Completed`, `Loss`, `Stopped`, and `Protected`
- fixed bot-registry hydration/cache scope so future bot work no longer reuses one global browser cache across different authenticated users

- added shared `ready contention` diagnostics for the safe lane so the fleet can see when multiple operationally ready bots overlap on the same pair
- exposed ready-contention entries, contended-ready bot count, and contended-ready symbol count from the shared read-model
- surfaced that contention in `Bot Settings` inside the fleet `Operational Readiness` section
- annotated `Bots Needing Attention` when a weak bot is also overlapping with another ready peer on the same pair
- kept concurrency diagnostics inside the same read-model seam instead of creating a separate fleet monitor
- promoted ready contention into shared attention/readiness logic so contended ready bots no longer remain counted as clean dispatch-ready
- surfaced ready contention in `Execution Logs` as a dedicated review filter and summary block
- updated `Signal Bot` so the selected bot's `Paper Readiness` note now explains when shared-lane contention is what is keeping it out of a clean ready state
- added a real `paper` dispatch guardrail for ready contention so active bots sharing the same pair do not progress preview dispatch in parallel
- added `Retry Dispatch` in `Execution Logs` for decisions paused by ready contention, keeping the recovery path inside the same shared review seam
- evolved ready contention into a shared `leader / follower` queue model so one bot can legitimately hold the current safe-lane slot while peers wait behind it
- surfaced queue position and leader language in `Signal Bot`, `Bot Settings`, and `Execution Logs`
- added automatic promotion back to `dispatch-requested` when a contention-blocked follower no longer has a live paper-lane leader ahead of it
- kept that promotion inside the existing operational loop and decision metadata instead of creating a separate queue worker
- added shared telemetry for queue auto-promotions so concurrent safe-lane validation can measure how often followers are being re-promoted automatically
- surfaced queue auto-promotion counts in `Signal Bot`, `Bot Settings`, and `Execution Logs`
- promoted repeated queue auto-promotions into shared attention/readiness logic so unstable contention churn now degrades clean ready state
- added a dedicated `Auto-Promoted` review path in `Execution Logs` so automatic queue promotions can be audited directly
- added fleet-level queue churn summaries so repeated queue auto-promotions are also visible from `Bot Settings`
- added a shared fleet-level `safe-lane stability` reading so the hub can judge whether the governed paper lane is forming, stable, watch-level, or fragile
- added a shared fleet-level `operational verdict` so the hub can now speak in a more direct readiness language: forming, validating, close, or not ready
- extended that same shared `operational verdict` into `Signal Bot` so the selected bot now exposes the same readiness language in both the execution-intent workspace and settings tab
- kept the selected-bot verdict derived from the shared read-model seam instead of introducing a local per-screen verdict computation
- extended that same shared `operational verdict` and `safe-lane stability` language into `Execution Logs` so the review console now uses the same fleet judgment as the hub and selected-bot workspace
- kept `Execution Logs` on the shared seam instead of creating a console-specific operational verdict
- promoted the shared fleet `operational verdict` into a runtime guardrail so `demo` dispatch now pauses when the lane is still `forming` or `not-ready`
- kept recovery for those verdict-paused intents inside `Execution Logs` by allowing the same retry path once the fleet verdict improves
- tightened that guardrail further so governed `demo` dispatch now unlocks only when the shared fleet verdict reaches `close`
- stopped treating `validating` as sufficient for demo progression, keeping the lane conservative until the shared stability threshold is truly met
- added a shared `Governed Demo Gate` summary derived from that same fleet verdict
- surfaced the governed demo gate in `Bot Settings`, `Signal Bot`, and `Execution Logs` so the final demo unlock is now explicit across the main operational surfaces
- added a shared `Paper/Demo Operational Status` declaration derived from the governed demo gate
- surfaced that final operational declaration in `Bot Settings`, `Signal Bot`, and `Execution Logs` so the main surfaces now say explicitly whether the governed paper/demo lane is operational or not
- added a shared `Bots Operational Now` declaration derived from that same governed paper/demo operational status
- surfaced that yes/no declaration in `Bot Settings`, `Signal Bot`, and `Execution Logs` so the product can answer directly whether bots are operational in the governed safe lane

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
  - stale paper previews now also get an explicit effective lifecycle meaning inside the shared seam:
    - `preview-expired`
  - `Execution Logs`, `Signal Bot`, and owned-memory notes now use that expiry language directly instead of only saying “stale”
  - `Execution Logs` now also lets the operator refresh a `preview-expired` intent back into `dispatch-requested` without leaving the shared bot-decision seam
  - repeated preview refreshes now persist on the same decision seam and increase shared bot-attention scoring
  - expired preview load and preview refresh churn now surface in `Bot Settings` weakest-bot diagnostics instead of staying implicit
  - severe preview churn now also surfaces inside `Signal Bot` as `Preview Churn` and `Intent Attention`, keeping paper-lane instability visible on the selected bot itself
  - severe preview churn now also pauses new `paper` dispatches inside the shared operational loop, with the block reason persisted on the same bot-decision seam
  - `Execution Logs` now lets the operator grant a one-time churn pardon for a decision blocked by severe preview churn, and the shared runtime consumes that pardon once during the next paper dispatch attempt
  - churn pardons are now counted in the shared intent summary and feed back into bot attention diagnostics instead of remaining hidden as one-off recovery metadata
  - repeated churn pardons are no longer effectively unlimited: once the safe limit is reached, `Execution Logs` switches the action to `Manual Review Required` and the runtime keeps paper preview dispatch blocked
  - after churn pardons are exhausted, `Execution Logs` now exposes a stronger one-time `Manual Clear` override, and the shared runtime consumes it separately from pardons while still counting it in shared diagnostics
  - `Execution Logs` now also has a dedicated `Recovery Governance` filter and recovery counts in bot summaries, so expired previews, pardons, manual clears, and manual-review cases can be operated as their own backlog
  - `Execution Logs` now also exposes a final `Hard Reset` recovery action after `Manual Clear`, and the shared runtime counts and consumes that override separately so the strongest recovery path is still governed and visible
  - `Hard Reset` is now treated and labeled as the final paper-lane override; after that boundary the product switches to final manual review language instead of implying more hidden recovery steps
  - the shared seam now also exposes `operational readiness` so the fleet hub and the selected bot can say explicitly whether a bot is `ready`, still in `recovery`, or already in `final review`
  - `Bot Settings` now also has a dedicated `Operational Readiness` fleet section so the operator can immediately see which bots are `ready`, still in `recovery`, or already in `final review`
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

## User Intent Translation Rule

Future contributors should treat human UX or visual instructions as product intent, not as a mandatory literal description of internal system design.

In practice:

- if the human says how something should look or feel, implement the requested end-user behavior even if the internal logic needs to be solved differently
- prefer the most correct, efficient, maintainable, and architecture-safe implementation that produces the requested visible result
- do not copy the human's described logic literally when a cleaner technical approach exists
- keep the UI aligned with the requested experience while deciding internally what should live in:
  - UI
  - shared read-models
  - bot core / signal core / market core
  - backend validation or execution seams
- escalate only when the requested visible behavior would force a non-obvious structural tradeoff or meaningful product-risk decision

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

## Implementador - 2026-03-21 - Signal Bot Runtime, Feed, And Workspace Hardening

### What Was Done

- Reworked `Signal Bot -> Active Signals` so the selected bot now reads a real scoped signal feed instead of depending on generic or overly narrow fallbacks.
- Hardened the bot scope so signals now respect the selected bot's configured:
  - active trading pairs
  - active timeframes
  - execution/account context
- Added `Signal Settings` inside `Signal Bot -> Bot Settings` with real controls for:
  - `Auto-Execute Trades`
  - `Push Notifications`
  - `Max Position Size`
  - `Capital`
- Added real `Active Trading Pairs` management:
  - chip removal
  - `Add Pair` drawer
  - exchange-aware pair search
  - duplicate prevention
- Added real `Active Timeframes` management:
  - chip removal
  - `Add Timeframe` drawer
  - duplicate prevention
  - stable lower-to-higher ordering
- Removed the older lower settings summary grid from `Signal Bot -> Bot Settings` so the page now stays focused on configuration blocks that actually mutate the bot.
- Added timeframe badges to active signal cards.
- Added pagination to active signals in groups of six.
- Added a signal detail drawer opened from the eye icon so the user can inspect:
  - confidence
  - entry/current/target/stop
  - AI analysis notes
  - risk/reward
  - potential profit
- Fixed the signal detail drawer footer so `Dismiss` and `Execute Trade` remain visible at the bottom.
- Wired manual signal actions from the workspace:
  - `play` now dispatches the signal into the governed execution path
  - `X` now dismisses the signal through the bot decision seam
- Updated the read-model so handled signals disappear from `Active Signals` after the bot executes or dismisses them.
- Fixed snapshot reconciliation so different signal cards no longer reuse the same BTC snapshot values by mistake.
- Tightened signal-card direction and metadata shaping so real cards no longer lean on weak heuristics when better signal context exists.
- Corrected `Signal Bot` active-signal counting and paging so the header no longer inflates counts with repeated historical snapshots.

### Why This Was Correct

- The bot workspace can no longer behave like a decorative shell over a generic market feed.
- The selected bot now exposes the same real operating scope that the user configures from the bot settings blocks.
- Manual actions in the signal grid now match product intent:
  - inspect
  - execute
  - dismiss
- This removes a large class of UX drift where the workspace looked correct visually but still behaved like a partial lab surface.

### Files Touched

- `api/_lib/bots.js`
- `src/hooks/useSignalsBotsReadModel.ts`
- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/user-experience-architecture.md`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### What To Review

- `Signal Bot -> Active Signals` should now:
  - page in groups of six
  - show timeframe badges
  - exclude signals outside the bot's configured timeframes
  - avoid repeating the same `symbol + timeframe` card cohort across pages
- The eye icon should now open a real right drawer with signal detail.
- The play icon should now attempt real governed execution.
- The X icon should now dismiss the signal and remove it from the active feed.
- `Signal Bot -> Bot Settings` should now manage the selected bot's:
  - capital
  - max position size
  - pairs
  - timeframes
  - auto-execute
  - notifications

### Remaining Risk

- Critical financial validation is now much stronger in the client, but the strongest next hardening step would still be to mirror the same guardrails at the backend/API layer.
- Signal production can still legitimately cluster around one symbol if `signal core` is emitting that way in the moment; the workspace now dedupes and paginates better, but it does not artificially invent symbol diversity.

### Next Recommended Step

- Keep validating the live bot with the current production feed and confirm:
  - execute/dismiss actions produce the right downstream runtime behavior
  - the active signal cohort stays stable over time
  - no out-of-scope timeframe or duplicate-card regressions return

### Progress Estimate

- Estimated remaining work to leave `Signal Bot` and the bot-facing signal workflow at the current target quality bar: `5% - 10%`.

## 2026-03-21 - Handoff Addendum: confidence split + compact operational visibility

### What Was Done

- Clarified `Signal Bot` confidence semantics so the active cards and detail drawer no longer present ranking score as if it were execution approval:
  - `Signal Score` now clearly maps to the ranking/composite layer
  - `Execution Readiness` now reflects scorer/adaptive execution context when available
- Added a compact operational summary block back into `Signal Bot -> Bot Settings` using existing read-model state:
  - automation
  - dispatch queue
  - ownership health
  - attention pressure
- Kept the surface compact and user-facing instead of restoring the larger fleet readiness dashboard that had previously been removed.

### Why This Was Correct

- The UI had real semantic drift between visible `AI Confidence` and the lower execution scorer/backend confidence.
- The bot core already knew when the governed lane was closed, when intents were queued, and when ownership health was degraded; the selected bot workspace simply was not showing enough of that state.
- This round improves operator clarity without creating a second architecture or moving authority back into the UI.

### Files Touched

- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### Validation

- `npm run typecheck`
- `npm run build`

### What Should Be Reviewed

- `Signal Bot -> Active Signals` should now show:
  - `Signal Score`
  - a separate execution-readiness line
  - scorer confidence only when the signal actually carries it
- `Signal Bot -> signal detail drawer` should now distinguish:
  - ranking/priority score
  - execution readiness / scorer confidence
- `Signal Bot -> Bot Settings` should now explain:
  - whether auto is really free to move
  - whether intents are queued/dispatching/idle
  - whether ownership health is stable or needs attention
  - whether queue churn or other pressure is accumulating

### Remaining Risk

- The surface is now much clearer, but some history rows still represent mixed runtime events more than pure trade closures.
- The execution path is harder and safer now, but still not the final fully bot-aware backend bridge we want long term.

### Next Recommended Step

- Finish the minimal bot closure pass by tightening:
  - trade-history semantics
  - create/edit bot flow stability
  - any remaining client-heavy authority that still needs backend duplication

### Progress Estimate

- Estimated remaining work to leave the current bot-module closure phase complete: `20%`.

## 2026-03-21 - Handoff Addendum: signal history now prioritizes bot-readable actions

### What Was Done

- Tightened `Signal Bot -> Signal History` so it now favors bot-readable history rows over lower-level runtime transitions.
- Added pair metadata in the row identity so the user can read pair + timeframe/context together.
- Hid several noisy event classes from this surface:
  - observe-only decisions without real execution linkage
  - preview-only execution rows
  - queue/dispatch preview transitions that still belonged more to runtime operations than to user-facing history
- Normalized visible status labels to a more product-friendly language.

### Why This Was Correct

- The history tab should primarily answer:
  - what did the bot trade
  - what did it block
  - what did it submit
  - what completed or lost
- The bot core still keeps the richer runtime data, but this product surface should not force the user to read every internal lane transition.

### Files Touched

- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### Validation

- `npm run typecheck`
- `npm run build`

### What Should Be Reviewed

- `Signal Bot -> Signal History` should now:
  - read more like bot trading history
  - show pair + timeframe/context together
  - avoid preview/runtime-only noise
  - keep blocked/dismissed actions when they represent a real bot action worth surfacing

### Remaining Risk

- Exit values are still constrained by the order/signal linkage data currently available in the shared read-model.
- Some rows intentionally remain "bot action" rows instead of only closed trades because the product still needs to explain real bot decisions.

### Next Recommended Step

- Finish the closure pass around:
  - create/edit bot stability
  - the last history-row semantics that might belong in execution logs instead
  - any remaining backend authority gaps for bot controls

### Progress Estimate

- Estimated remaining work to leave the current bot-module closure phase complete: `14%`.

## 2026-03-21 - Handoff Addendum: backend bot contract is now less UI-dependent

### What Was Done

- Strengthened `api/_lib/bots.js` so create/update requests now normalize the bot contract more aggressively.
- The backend now resolves ambiguous payloads into a coherent persisted mode for:
  - `automationMode`
  - `executionEnvironment`
  - `executionPolicy`
  - primary pair / default trading pair
  - timeframe preferences
- Updated the `Signal Bot` auto toggle to send a cleaner downgrade back to observe/manual semantics.

### Why This Was Correct

- The UI still drives a lot of bot settings, but the backend should not trust mixed combinations blindly.
- This round reduces a meaningful class of drift where:
  - the UI looked manual but execution flags stayed too permissive
  - or the UI looked auto but the persisted contract remained semantically mixed
- It keeps the current architecture intact while giving the bot core/API more authority over the final saved state.

### Files Touched

- `api/_lib/bots.js`
- `src/views/SignalBotView.tsx`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### Validation

- `npm run typecheck`
- `npm run build`

### What Should Be Reviewed

- Toggling `Auto-Execute` off should now land the bot in a cleaner observe/manual contract.
- Mixed client payloads around automation/execution policy should now persist in a more coherent final state.
- Pair/timeframe defaults should stay aligned after bot create/update calls.

### Remaining Risk

- The bot config contract is now materially harder, but the end-to-end execution bridge can still be improved further so manual and auto execution are even more explicitly bot-owned.

### Next Recommended Step

- Use the remaining closure pass to verify:
  - create/edit stability
  - last client-heavy controls
  - final bot-to-execution ownership bridge

### Progress Estimate

- Estimated remaining work to leave the current bot-module closure phase complete: `9%`.

## 2026-03-21 - Handoff Addendum: bot-aware execution ownership is now materially stronger

### What Was Done

- Bot-originated execution dispatches now carry explicit bot context deeper into the execution engine.
- `Signal Bot` manual execute and governed auto dispatch now send bot-aware context instead of behaving like anonymous signal execution.
- Execution records now persist bot context in their payload when the dispatch came from a bot.
- Bot decisions can now capture `executionOrderId` earlier when the execution engine returns the created order record.
- Ownership reconciliation in the read-model now prioritizes direct `botContext.botId` linkage before heuristic matching.

### Why This Was Correct

- This was one of the most important remaining architecture gaps:
  - the UI and bot core knew which bot executed
  - but the final execution record was still not consistently bot-aware enough
- The new bridge does not rewrite the architecture. It strengthens the existing one so bot identity survives further into execution and reconciliation.

### Files Touched

- `src/data-platform/contracts.ts`
- `src/services/api.ts`
- `src/hooks/useBinanceData.ts`
- `src/views/SignalBotView.tsx`
- `src/hooks/useBotOperationalLoop.ts`
- `src/hooks/useSignalsBotsReadModel.ts`
- `api/_lib/executionEngine.js`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### Validation

- `npm run typecheck`
- `npm run build`

### What Should Be Reviewed

- Manual execute from `Signal Bot` should now create decisions that link more directly to owned execution records.
- Auto dispatch from the operational loop should now preserve bot identity deeper into the execution record.
- Ownership and history should now be less dependent on heuristic reconciliation for new executions created after this change.

### Remaining Risk

- Historical records created before this round will still rely on older ownership heuristics.
- There is still room for a future deeper pass where bot policy itself participates even more explicitly in final execution-time validation.

### Next Recommended Step

- Finish the closure pass with a final verification round over:
  - create/edit bot stability
  - legacy history rendering
  - any last client-heavy control that still needs backend duplication

### Progress Estimate

- Estimated remaining work to leave the current bot-module closure phase complete: `4%`.

## 2026-03-21 - Handoff Addendum: quick create/edit is now safer for live bot state

### What Was Done

- Fixed the quick create/edit flow so editing a bot no longer unintentionally overwrites its active trading universe down to a single pair.
- The edited pair is now promoted as the primary pair while preserving the rest of the existing custom-list symbols.
- Fixed quick capital edits so they no longer reset free capital as if no capital were already in use.
- Normalized quick-edit pairs before persisting them.

### Why This Was Correct

- This was a real state-integrity issue:
  - a simple edit could rewrite the bot universe more aggressively than the user intended
  - capital state could drift from runtime truth after an edit
- The UX remains simple, but the persisted bot state now respects more of the already-live operational truth.

### Files Touched

- `src/views/BotSettingsView.tsx`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

### Validation

- `npm run typecheck`
- `npm run build`

### What Should Be Reviewed

- Quick edit should no longer collapse multi-pair bots to one pair.
- Capital edits should preserve capital already in use instead of resetting available capital blindly.
- Pair values should stay normalized after save.

### Remaining Risk

- The remaining work is now mostly live verification/QA rather than another major implementation gap.

### Next Recommended Step

- Run the final review pass in the live app and close the phase if no regressions appear.

### Progress Estimate

- Estimated remaining work to leave the current bot-module closure phase complete: `1%`.

## 2026-03-21 - Handoff Addendum: implementation closure reached

### Final Read

- The current bot-module implementation phase is effectively closed.
- No new structural regression surfaced in the final implementation audit after:
  - bot config hardening
  - signal-history cleanup
  - confidence/operational clarity work
  - bot-aware execution ownership bridge
  - quick create/edit stabilization

### What Remains

- The remaining step is product acceptance / live QA in the running app.
- This is now a verification task, not another architecture or implementation gap.

### Verification

- `npm run typecheck`
- `npm run build`

### Progress Estimate

- Bot-module implementation for this phase: `100% complete`
- Remaining live acceptance / verification follow-up: `1%`

## 2026-03-21 - Handoff Addendum: backtesting verification completed

### Verification Performed

- Ran a real strategy-engine validation/backtesting cycle for user `jeremias`.
- The run was enqueued and processed successfully after the bot-module closure work.

### Result Snapshot

- Run id: `8`
- Status: `completed`
- Active scorer: `adaptive-v1`
- Maturity score: `77/100`
- Closed signals audited: `139`
- Feature snapshots: `320`
- Passed invariants: `3`
- Warned invariants: `2`
- Failed invariants: `0`

### Why This Matters

- This gives a real technical verification pass beyond `typecheck` and `build`.
- No hard invariant failure appeared after the bot-module changes, which supports closing the implementation phase.
- Remaining follow-up is product acceptance/monitoring, not another major implementation gap inside the current bot-module phase.

### Progress Estimate

- Bot-module implementation for this phase: `100% complete`
- Remaining live acceptance / verification follow-up after successful backtesting: `0% - 1%`

## 2026-03-21 - Handoff Addendum: multi-user isolation hardening

### Final Read

- The multi-user bug was broader than the bot-registry cache alone.
- `useSelectedBot` was already fixed earlier, but cross-user contamination risk still existed in:
  - `useBotDecisions`
  - watchlist warm-cache hydration
  - hot cached API responses reused across authenticated users

### What Changed

- Bot decisions are now session-scoped in memory and in localStorage.
- Watchlist warm cache is now stored by authenticated username instead of one shared browser key.
- Hot API cache entries are now session-scoped and automatically invalidated when the authenticated user changes.

### Why This Matters

- This is the layer that protects real QA between `jeremias` and `yeudy` from showing each other's stale frontend state after login/logout, reloads or fast account switching.
- Without this, the app could still appear to "reset" bots or watchlists when in reality it was hydrating stale browser state from another account.

### Validation

- `npm run typecheck`
- `npm run build`

### What Should Be Reviewed

- Run a live two-user QA pass:
  - create/edit bot in `jeremias`
  - reload
  - logout/login as `yeudy`
  - confirm bot list, disabled list, watchlist and signal history stay user-owned
  - switch back to `jeremias` and verify his names, pairs and timeframes still persist

### Progress Estimate

- Multi-user isolation hardening for the current acceptance round: `97% complete`
- Remaining work: `3%` live verification with both real accounts

## 2026-03-21 - Handoff Addendum: platform-wide multi-user isolation follow-up

### Final Read

- The earlier multi-user fixes were necessary but not sufficient to claim platform-wide isolation.
- A deeper audit found additional cross-user risks outside the bot registry:
  - `useSignalMemory` lacked username race protection
  - `syncSystemDataPlane` kept signal memory alive after logout
  - `ProfileView` persisted local profile/notification settings in one global browser key

### What Changed

- `useSignalMemory` now guards asynchronous responses and follow-up refreshes by username.
- The shared system plane now clears `signalMemory` when the user is not authenticated.
- Profile/account local settings are now namespaced by username and rehydrated on account switch.

### Why This Matters

- These were real reasons not to certify the platform as fully isolated per user.
- After this round, the audited cross-user leakage paths are much tighter across:
  - bots
  - bot decisions
  - watchlists
  - hot API cache
  - signal memory
  - local profile preferences

### Validation

- `npm run typecheck`
- `npm run build`

### What Should Be Reviewed

- Run a final live `jeremias -> yeudy -> jeremias` QA pass covering:
  - bot lists / disabled bots
  - signal history / signal memory
  - watchlists
  - profile local settings
  - account identity shown in sidebar/topbar

### Progress Estimate

- Platform-wide multi-user isolation hardening: `99% complete`
- Remaining work: `1%` live browser verification before claiming full certification

## 2026-03-21 - Signal History must stay trade-only

### Context

- User reported that manually accepted signals could still appear in `Signal History` as `Reviewed`, even though the visible product intent is that this tab should only show actual bot trades.
- This was happening because `SignalBotView` still had fallback normalization branches that could turn raw decisions or signal snapshots into history rows.

### What Changed

- Restricted `Signal History` row creation to execution-backed activity only:
  - activity timeline order entries
  - activity timeline decision entries only when they are already linked to a real execution order
- Removed the raw decision/timeline/signal fallback branches from `createSignalHistoryRow`.
- Tightened status mapping so rows without real execution backing are not promoted into fake trade results.

### Why This Matters

- `Signal History` now behaves more like the trading-history template and less like an internal bot activity log.
- Manual review/assist actions should live in operational logs, not in the user-facing trade history tab.

### Validation

- `npm run typecheck`
- `npm run build`

### What The Next Agent Should Review

- Manually execute signals from `Active Signals` and confirm the history only shows real `BUY` / `SELL` operations.
- Confirm `Reviewed` / assist-only rows do not reappear in `Signal History`.
- If the user wants this tab even closer to the template, the next step is purely UX polish and row semantics, not reopening mixed decision history here.

### Progress Estimate

- Signal History trade-only behavior: `92% complete`
- Remaining work: `8%` live browser validation and fine visual alignment

## 2026-03-21 - Disabling a bot now respects live operations

### Context

- User found that the product still allowed disabling a bot even when it was turned on and carrying live operations.
- Two UX paths were discussed:
  - block the disable
  - or explicitly warn that all operations will be closed first
- For this phase we chose the safer and more honest implementation: block the disable while live operations remain.

### What Changed

- `BotSettingsView` now counts live execution-backed operations from the bot's execution timeline before confirming a disable.
- If live operations exist, the disable modal becomes a warning-only dialog and the destructive confirm button is removed.
- If no live operations exist, the normal disable flow still works.

### Why This Matters

- This prevents the UI from claiming a bot can be disabled cleanly while it still has open/protected positions.
- We intentionally avoided implementing an automatic close-all promise without a fully hardened backend close flow.

### Validation

- `npm run typecheck`
- `npm run build`

### What The Next Agent Should Review

- Try disabling:
  - an active bot with live/protected operations
  - a bot with no live operations
- Confirm only the second case can proceed.
- If product later wants the second UX path, the next step is a true close-positions workflow in core/backend before disable, not just a modal message.

### Progress Estimate

- Bot disable live-operation guardrail: `94% complete`
- Remaining work: `6%` live browser confirmation and optional future close-all flow

## 2026-03-21 - Signal History should ignore non-executed signal actions

### Context

- User clarified the product rule more strictly:
  - `Signal History` should only show the actual `BUY` / `SELL` operation created from a signal
  - if the signal did not execute, it should show nothing here
  - explanation of failed / reviewed / non-executed attempts belongs to another future screen

### What Changed

- `SignalBotView` no longer uses the mixed `selectedBotActivityTimeline` as the source for `Signal History`.
- The tab now reads from `selectedBotExecutionTimeline`, which is execution-backed bot activity only.
- Execution ownership entries now carry an explicit normalized `side` so rows can render as `BUY` / `SELL` instead of generic actions.

### Why This Matters

- This aligns the tab with the user's mental model:
  - history = operations that really happened
  - not execution attempts, reviews, assists, or bot-internal transitions

### Validation

- `npm run typecheck`
- `npm run build`

### What The Next Agent Should Review

- Execute signals manually and verify successful executions show as `BUY` / `SELL`.
- Verify non-executed attempts leave no row in `Signal History`.
- If any row still appears with `ASSIST`, `EXECUTE`, or `Reviewed`, treat it as a regression because the tab should now be execution-only.

### Progress Estimate

- Signal History execution-only source alignment: `96% complete`
- Remaining work: `4%` live browser confirmation and small UX polish if needed

## 2026-03-21 - System audit runner added for whole-app validation

### Context

- The user explicitly asked to stop relying on endless bug-by-bug fixes and to backtest/audit the current platform more deeply across:
  - market core
  - signal core
  - bot core
  - multi-user isolation
  - general data consistency

### What Changed

- Added [scripts/system-audit.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/scripts/system-audit.mjs).
- Added package command:
  - `npm run system-audit`
- The runner can:
  - read validation-lab/backtest state per user
  - optionally process queued backtests
  - inspect bot profiles, bot decisions, watchlists, signal snapshots and execution orders
  - compute signal-to-order consistency
  - flag cross-user bot-id overlap

### Validation Command Used

- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy --process-queue=true`

### Findings Confirmed By The Runner

- No bot-id overlap between `jeremias` and `yeudy`.
- Signal-to-order linkage is structurally weak for both users:
  - `jeremias`: `5/500` linked signals (`1%`)
  - `yeudy`: `2/500` linked signals (`0.4%`)
- `jeremias` latest validation-lab summary reports warnings, but the detailed invariant array came back empty.
- `yeudy` still has too many execution rows without explicit side metadata.

### Why This Matters

- We now have a repeatable system-level audit path instead of depending only on ad-hoc diagnosis.
- The audit confirms the remaining work is architectural consistency, not just isolated UI bugs.

### What The Next Agent Should Do

- Use `npm run system-audit` before and after structural cleanup work.
- Prioritize:
  - canonical signal -> execution linkage
  - stricter bot CRUD contract
  - validation-lab payload consistency
  - missing execution side metadata

### Progress Estimate

- Whole-app audit tooling: `100% complete`
- Structural remediation after this audit: `70% remaining`

## 2026-03-21 - Multi-user browser smoke suite

### What Was Added

- Browser smoke config:
  - [playwright.config.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/playwright.config.mjs)
- Main suite:
  - [tests/e2e/multi-user-isolation.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/multi-user-isolation.spec.mjs)
- Stable selectors added to:
  - [src/components/LoginOverlay.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/LoginOverlay.tsx)
  - [src/components/Sidebar.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/Sidebar.tsx)
  - [src/views/BotSettingsView.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/views/BotSettingsView.tsx)

### Commands

- `npm run test:e2e`
- `npm run test:e2e:headed`

### Preview Used For Validation

- [https://binance-trading-analysis-tool-ewps4z7lw.vercel.app](https://binance-trading-analysis-tool-ewps4z7lw.vercel.app)

### What The Suite Covers

- login as `jeremias`
- login as `yeudy`
- compare visible bot cards vs `/api/bots`
- verify `Disabled` filter vs API
- verify logout/login in the same browser context clears visible state

### Current Results

- `chrome`:
  - same-context user switching: pass
  - parallel dual-user contexts: pass when chrome runs alone
- `webkit`:
  - same-context user switching: pass
- `chrome + webkit` together:
  - same-context user switching: pass in both engines
  - parallel dual-user contexts: fail in both engines

### Important Interpretation

- The browser suite now confirms that visible state can stay isolated in sequential switching scenarios.
- The unresolved issue is a concurrency/startup problem under heavier parallel stress.
- The failure looked like:
  - one browser stuck in `Preparando acceso`
  - another browser already inside `Bot Settings`
- That points more to bootstrap/runtime contention than obvious cross-user data mixing.

### What The Next Agent Should Do

- Keep using the browser suite together with `npm run system-audit`.
- Next structural target should be the startup/bootstrap path:
  - session bootstrap
  - workspace initial load
  - realtime/bootstrap fallbacks
  - any shared singleton that can delay parallel sessions

### Progress Estimate

- Browser smoke tooling: `100% complete`
- Definitive multi-browser parallel stability: `35% remaining`

## 2026-03-21 - Bot contract hardening and validation-lab contract stabilization

### What Was Added / Changed

- Bot CRUD hardening in [api/_lib/bots.js](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/api/_lib/bots.js):
  - strict top-level client allowlist
  - nested allowlists for editable bot sections
  - runtime-owned fields from client payloads now fail fast instead of mutating bot truth
  - explicit empty arrays now clear scope cleanly instead of reviving stale symbols/watchlists/timeframes
  - explicit empty tag lists now stay empty
- Validation-lab contract stabilization in [api/_lib/strategyEngine.js](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/api/_lib/strategyEngine.js):
  - stored reports now normalize to a stable response shape
  - incomplete stored reports with summary counts but no detailed artifacts now trigger regeneration
- Backend regression suite:
  - [tests/backend/bots-contract.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/bots-contract.test.mjs)
  - [tests/backend/strategy-validation.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/strategy-validation.test.mjs)
  - package command `npm run test:backend`

### Validation

- `npm run test:backend` -> pass (`7/7`)
- `npm run typecheck` -> pass
- `npm run build` -> pass

### Why This Matters

- This closes the first structural P1s from the audit:
  - backend bot CRUD was too permissive
  - array merges were not idempotent
  - validation lab could expose inconsistent payload shapes
- It also gives the next phase a safer base for canonical signal/execution linkage work.

### What The Next Agent Should Do

- Start the `Canonical Trade Chain` phase:
  - define one canonical linkage across:
    - signal
    - decision
    - execution order
    - outcome
  - make `Signal History`, ownership and performance read from that chain instead of mixed timelines
- Extend regression coverage after that phase with:
  - signal execution -> history
  - disable with live positions
  - multi-user session smoke

### Progress Estimate

- Structural remediation completed in this pass: `15%`
- Structural remediation still remaining after this pass: `55%`

## 2026-03-21 - Canonical trade chain first slice

### What Was Added / Changed

- New domain module:
  - [src/domain/bots/tradeChain.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/domain/bots/tradeChain.ts)
- Export wired in:
  - [src/domain/index.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/domain/index.ts)
- Read-model integration in:
  - [src/hooks/useSignalsBotsReadModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalsBotsReadModel.ts)
- Signal history consumption updated in:
  - [src/views/SignalBotView.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/views/SignalBotView.tsx)

### What This Slice Does

- Builds canonical bot trades from:
  - decision linkage
  - execution orders
  - signal snapshots
- Filters out non-real execution noise:
  - preview-only records
  - blocked pseudo-executions
  - entries without a valid trade side
- `Signal History` now prefers canonical `BUY` / `SELL` trades instead of mixed activity/runtime records.
- Execution breakdowns now prefer canonical execution orders when available, reducing product noise from blocked/unowned records.

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass

### What The Next Agent Should Do

- Continue the canonical chain deeper:
  - unify direct linkage quality across `signal -> decision -> execution order -> outcome`
  - reduce heuristic fallback where possible
- Then move into the read-model split:
  - market
  - signal
  - bot workspace
  - execution ownership
  - fleet summaries
- Add regression coverage for:
  - signal execution -> signal history
  - disable with live positions
  - multi-user browser isolation

### Progress Estimate

- `Canonical Trade Chain` current progress: `45% complete`
- Structural remediation still remaining after this pass: `45%`

## 2026-03-21 - Canonical trade chain hardening and regression coverage

### What Was Added / Changed

- Hardened [src/domain/bots/tradeChain.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/domain/bots/tradeChain.ts) to prefer the latest real execution when multiple orders exist for the same signal.
- Added regression coverage in:
  - [tests/backend/trade-chain.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/trade-chain.test.mjs)

### Why This Matters

- The first slice created the canonical trade layer.
- This follow-up reduces one more source of unstable behavior:
  - signal history should not depend on whichever order was seen first
  - it should prefer the latest real execution when the direct signal link is incomplete

### Validation

- `npm run test:backend` -> pass (`11/11`)
- `npm run build` -> pass
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy`

### Current Audit Interpretation

- Multi-user data separation still looks clean at database/system-audit level.
- The primary structural bottleneck is still weak persistence of direct `signal -> execution_order_id` linkage:
  - `jeremias`: `1%`
  - `yeudy`: `0.6%`
- `yeudy` still has missing execution side metadata in part of the execution layer.

### What The Next Agent Should Do

- Continue the canonical chain upstream:
  - improve persistence of `execution_order_id` on signals
  - reduce cases where ownership depends on heuristics
  - improve side metadata completeness for execution orders
- Then begin splitting [src/hooks/useSignalsBotsReadModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalsBotsReadModel.ts) into smaller read-model selectors.

### Progress Estimate

- `Canonical Trade Chain`: `60% complete`
- Structural remediation still remaining after this pass: `40%`

## 2026-03-21 - Execution reconciliation hardening and corrected audit readout

### What Was Added / Changed

- Added exact signal lookup by ids in [api/_lib/signals.js](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/api/_lib/signals.js).
- Hardened [api/_lib/executionEngine.js](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/api/_lib/executionEngine.js):
  - missing signals are now fetched by id before reconciling execution orders
  - execution side tries harder to normalize to `BUY` / `SELL`
  - manual execution and protection attachment now fetch the exact source signal by id instead of relying on short recent windows
  - added `reconcileExecutionRecordsForUser()` for structural reconciliation / audit usage
- Added regression coverage in:
  - [tests/backend/execution-reconciliation.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/execution-reconciliation.test.mjs)
- Upgraded [scripts/system-audit.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/scripts/system-audit.mjs):
  - execution reconciliation runs before the audit snapshot
  - audit now measures exact linkage across execution-referenced signals instead of only the recent signal window

### Why This Matters

- The earlier audit made the canonical chain look worse than it really was because it compared:
  - a recent 500-signal window
  - against historical execution orders
- After this correction, the structural picture is clearer:
  - `jeremias`: `392/392` exact referenced links (`100%`)
  - `yeudy`: `187/187` exact referenced links (`100%`)
- So the main remaining problems are no longer:
  - broken exact linkage for referenced executions
- They are now:
  - weak direct `execution_order_id` coverage across the broad recent signal window
  - missing `BUY/SELL` metadata in part of `yeudy`'s execution layer
  - missing persisted `executionLearning` on closed signals

### Validation

- `npm run test:backend` -> pass (`14/14`)
- `npm run build` -> pass
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy`

### What The Next Agent Should Do

- Start the next structural slice with the remaining real bottlenecks:
  - improve broad direct `execution_order_id` coverage in the latest signal window
  - backfill / normalize execution side metadata where possible
  - improve `executionLearning` persistence for closed signals
- After that, begin splitting [src/hooks/useSignalsBotsReadModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalsBotsReadModel.ts) into smaller selectors/read-model modules.
- Keep the audit honest:
  - referenced execution linkage is now healthy
  - do not treat the old `1% / 0.6%` window metric as the whole story anymore

### Progress Estimate

- `Canonical Trade Chain`: `75% complete`
- Structural remediation still remaining after this pass: `30%`

## 2026-03-21 - Validation semantics cleanup and read-model extraction slice two

### What Was Added / Changed

- Refined [api/_lib/strategyEngine.js](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/api/_lib/strategyEngine.js):
  - execution-learning coverage now audits only closed signals that truly belong to the execution path
  - small valid samples no longer warn due to an oversized threshold
- Refined [scripts/system-audit.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/scripts/system-audit.mjs):
  - `missingSidePct` now applies only to trade-relevant orders
  - blocked/neutral runtime records are no longer treated as if they should carry `BUY/SELL`
  - helper exports were added so this behavior is testable
- Added regression coverage:
  - [tests/backend/system-audit.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/system-audit.test.mjs)
  - expanded [tests/backend/strategy-validation.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/strategy-validation.test.mjs)
- Continued the read-model split:
  - moved adaptation/readiness/governed-lane summary helpers from [useSignalsBotsReadModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalsBotsReadModel.ts)
  - into [src/domain/bots/readModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/domain/bots/readModel.ts)

### Why This Matters

- The audit is now much more honest: it no longer flags blocked neutral records as if they were malformed trades.
- The validation lab is now aligned with operational reality instead of penalizing signals that never entered the real execution chain.
- The giant read-model hook is shrinking in the right direction: more pure domain logic, less UI-adjacent monolith.

### Current Structural Readout

- `system-audit` now returns `findings: []`
- exact referenced linkage is still healthy:
  - `jeremias`: `392/392` exact referenced links
  - `yeudy`: `187/187` exact referenced links
- trade-relevant missing side metadata:
  - `jeremias`: `0%`
  - `yeudy`: `0%`
- backtesting rerun after the cleanup:
  - `jeremias`: `run 10`, `maturityScore 86`, `passed 4`, `warned 1`, `failed 0`
  - `yeudy`: `run 11`, `maturityScore 86`, `passed 4`, `warned 1`, `failed 0`
- only warning still standing:
  - no active persisted model in `ai_model_configs`

### Validation

- `npm run test:backend` -> pass (`22/22`)
- `npm run build` -> pass
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy`
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy --run-backtest=true --process-queue=true --label=codex-structural-remediation --trigger-source=codex-structural-remediation`

### What The Next Agent Should Do

- Continue the read-model split in [useSignalsBotsReadModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalsBotsReadModel.ts):
  - extract ownership/activity helpers next
  - then extract fleet summaries/selectors
- After the read-model is split further, return to the remaining non-structural warning:
  - formalize the persisted active model in `ai_model_configs`
- Keep using `system-audit` as the regression gate; it is finally aligned with the real execution semantics.

### Progress Estimate

- `Canonical Trade Chain`: `90% complete`
- `Read-Model Refactor`: `35% complete`
- Structural remediation still remaining after this pass: `20%`

## 2026-03-21 - Read-model extraction slice three (ownership and memory)

### What Was Added / Changed

- Moved another large block of pure logic out of [useSignalsBotsReadModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalsBotsReadModel.ts) and into [src/domain/bots/readModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/domain/bots/readModel.ts):
  - execution ownership scoring / reconciliation
  - execution breakdown summaries
  - bot activity timeline assembly
  - owned memory summaries
  - ownership summary
  - disabled memory helper
- Expanded regression coverage in [tests/backend/bot-read-model.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/bot-read-model.test.mjs) to lock an important ownership rule:
  - unresolved `blocked` and `dismissed` decisions must not inflate ownership debt

### Why This Matters

- The main hook is now much closer to what it should be:
  - read-model composition
  - not a warehouse of unrelated operational logic
- Ownership and memory behavior now live in one place, are testable in isolation, and are safer to evolve.

### Validation

- `npm run test:backend` -> pass (`23/23`)
- `npm run build` -> pass

### What The Next Agent Should Do

- Keep pushing the read-model split:
  - extract the remaining signal-feed helpers (`dedupe`, published-signal mapping) if they still belong in domain
  - then consider whether fleet aggregation should become separate selectors
- After that structural slice, tackle the last standing non-structural warning:
  - formalize the active persisted model in `ai_model_configs`

### Progress Estimate

- `Canonical Trade Chain`: `90% complete`
- `Read-Model Refactor`: `55% complete`
- Structural remediation still remaining after this pass: `15%`

## 2026-03-21 - Read-model extraction slice four (feed and mapping helpers)

### What Was Added / Changed

- Removed the last local helper layer from [useSignalsBotsReadModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalsBotsReadModel.ts):
  - ranked dedupe
  - scope dedupe
  - published signal id normalization
  - decision published signal key mapping
- Moved those helpers into [src/domain/bots/readModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/domain/bots/readModel.ts).
- Expanded [tests/backend/bot-read-model.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/bot-read-model.test.mjs) to lock:
  - suffix stripping of bot-consumable ids
  - dedupe by `symbol + timeframe`

### Why This Matters

- The bot read-model hook is now much closer to a pure composition seam.
- The remaining risk in the hook is no longer “helper sprawl”; it is mostly the size of the returned assembled object and some fleet aggregation paths.

### Validation

- `npm run test:backend` -> pass (`25/25`)
- `npm run build` -> pass

### What The Next Agent Should Do

- Finish the read-model cleanup by deciding whether the remaining fleet aggregation block should become a separate selector/domain module.
- After that, move to the last non-structural warning:
  - formalize the active persisted model in `ai_model_configs`

### Progress Estimate

- `Canonical Trade Chain`: `90% complete`
- `Read-Model Refactor`: `70% complete`
- Structural remediation still remaining after this pass: `10%`

## 2026-03-21 - Read-model extraction slice five (workspace and fleet assembly)

### What Was Added / Changed

- Added [src/domain/bots/workspace.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/domain/bots/workspace.ts) to hold the remaining high-level bot workspace assemblers:
  - execution enrichment for bot cards
  - shared-memory and operational enrichment
  - fleet summary aggregation
- Simplified [useSignalsBotsReadModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalsBotsReadModel.ts) so it now delegates those large blocks to domain builders instead of carrying them inline.
- Expanded [tests/backend/bot-read-model.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/bot-read-model.test.mjs) with three additional regression scenarios:
  - executed activity counts only canonical trades
  - disabled shared-memory policies stay disabled after operational enrichment
  - fleet summary aggregation stays correct outside the hook

### Why This Matters

- The main bot read-model hook is now mostly orchestration/composition and much less of a monolithic operational bucket.
- The biggest remaining structural work is no longer the read-model seam itself; it is the last platform warning around persisted active model config.
- Build, backend regression suite and the multiuser system audit all stayed green after the extraction.

### Validation

- `npm run test:backend` -> pass (`28/28`)
- `npm run build` -> pass
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)

### What The Next Agent Should Do

- Finish the last structural warning by formalizing the persisted active model in `ai_model_configs`.
- After that, rerun:
  - `npm run test:backend`
  - `npm run build`
  - `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy`
- Only after that should the thread move back to UX polish or performance tuning of specific screens.

### Progress Estimate

- `Canonical Trade Chain`: `90% complete`
- `Read-Model Refactor`: `85% complete`
- Structural remediation still remaining after this pass: `5%`

## 2026-03-22 - Active model config closure (`ai_model_configs`)

### What Was Added / Changed

- Closed the last persistent validation warning in [api/_lib/strategyEngine.js](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/api/_lib/strategyEngine.js).
- `persistModelConfigRegistry()` no longer returns early when model-training runs are empty.
- Added `ensureActiveModelConfigForUser()` so validation and recommendation flows confirm that exactly one active model config exists after persistence.
- Fixed the actual DB write contract by changing `ai_model_configs` POSTs to:
  - `?on_conflict=username,label`
- Aligned both:
  - `upsertModelConfigsForUser()`
  - `setActiveModelConfigForUser()`
- Expanded backend regression coverage in [tests/backend/strategy-validation.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/strategy-validation.test.mjs) for active-config seeding and inactive-registry bootstrap.

### Why This Matters

- The remaining warning was caused by a real persistence gap, not just by a stale report.
- Historical inactive rows (`model-v2/v3/v4`) could block the active seed path because the POST was not using an explicit conflict target.
- Validation lab, recommendations and backtesting now share one persisted source of truth for the active scorer config.

### Validation

- `npm run test:backend` -> pass (`32/32`)
- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy --run-backtest=true --process-queue=true --label=codex-ai-model-config-on-conflict --trigger-source=codex-ai-model-config-on-conflict` -> pass (`findings: []`)
- Direct Supabase verification confirmed:
  - `jeremias -> adaptive-v1 active=true`
  - `yeudy -> adaptive-v1 active=true`

### What The Next Agent Should Do

- Treat the structural remediation phase as effectively closed.
- The next work should move to one of these fronts:
  - UI/product polish on top of the hardened bot/signal core
  - multi-browser parallel-session stabilization
  - performance tuning on specific heavy screens
- Do not reopen `ai_model_configs` unless a future audit shows a new regression.

### Progress Estimate

- `Canonical Trade Chain`: `95% complete`
- `Read-Model Refactor`: `90% complete`
- Structural remediation still remaining after this pass: `0% - 5%`

## 2026-03-22 - Session bootstrap hotfix (startup overlay deadlock)

### What Was Added / Changed

- Hardened [src/hooks/useAuth.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useAuth.ts):
  - valid session is set before the workspace bootstrap callback runs
  - bootstrap failures are logged and no longer block authenticated access forever
- Hardened [src/App.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/App.tsx):
  - `sessionChecked` is always finalized in `finally`
  - session restore can no longer deadlock on `Restaurando sesión`
- Added timeout protection to `authService.getSession()` in [src/services/api.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/services/api.ts).

### Why This Matters

- A valid cookie/session could still leave the app frozen on the startup overlay when the initial workspace bootstrap failed or stalled.
- This hotfix makes startup resilient: workspace bootstrap can fail, but the user should still reach the authenticated shell instead of being trapped on the restore screen.

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass

### What The Next Agent Should Do

- Treat this as a regression hotfix, not as a replacement for the broader multi-browser parallel-session work.
- If startup still feels slow after this fix, inspect realtime/bootstrap latency separately, but do not reintroduce a hard gate that can deadlock the session shell.

### Progress Estimate

- Hotfix status: `100% complete`
- Remaining work for this specific regression: `0%`

## 2026-03-22 - Parallel session stability hardening (certification pass)

### What Was Added / Changed

- Updated [src/hooks/useAuth.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useAuth.ts) so authenticated startup callbacks run in the background instead of blocking login/session restore completion.
- Updated [src/App.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/App.tsx) so the initial workspace bootstrap is time-bounded to 4 seconds before the shell is allowed to continue loading the rest in the background.

### Why This Matters

- The prior hotfix removed the infinite startup deadlock, but the app could still remain too long on `Preparando CRYPE` under slower realtime/bootstrap paths.
- This pass makes startup tolerant to degraded realtime/bootstrap latency, which was the main remaining source of false-negative E2E failures in the multi-user certification phase.

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass (`32/32`)
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)
- `npm run test:e2e -- --project=chrome tests/e2e/multi-user-isolation.spec.mjs` -> pass (`2/2`)

### Notes For The Next Agent

- Chrome now passes both:
  - parallel dual-user isolation
  - same-context user switching
- Local WebKit still aborts at launch in this environment (`Abort trap: 6`), so treat that as a tooling/runtime issue unless a future run reproduces it in another environment.
- The next best step in certification is either:
  - browser-level verification in another WebKit-capable environment
  - or moving to targeted performance/polish work now that the parallel Chrome gate is green

### Progress Estimate

- `Parallel Session Stability Hardening`: `80% complete`
- Remaining work for this front: `20%`

## 2026-03-22 - Multi-browser auth confirmation hardening

### What Was Added / Changed

- Hardened [src/hooks/useAuth.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useAuth.ts) so login/register confirm the authenticated session with a bounded retry loop instead of trusting a single immediate `getSession()` read.
- Updated [src/services/api.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/services/api.ts) so `authService.getSession()` accepts custom timeout values, allowing tighter auth confirmation retries without inheriting the default long session timeout.
- Expanded [playwright.config.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/playwright.config.mjs) with an opt-in Firefox project for browser certification.

### Why This Matters

- Firefox revealed a real auth race where the login cookie could be written slightly after the first `getSession()` call.
- That race left the shell on `Preparando acceso` even though the login succeeded.
- The fix closes a true multi-browser startup gap rather than just masking a flaky test.

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass (`32/32`)
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)
- Preview used for fullstack browser verification:
  - [https://binance-trading-analysis-tool-5e69i2mr0.vercel.app](https://binance-trading-analysis-tool-5e69i2mr0.vercel.app)
- Chrome E2E on preview -> pass (`2/2`)
- Firefox E2E on preview -> pass (`2/2`)

### Notes For The Next Agent

- Do not use local static `vite preview` as the final auth-certification target; it does not serve the production `/api/*` routes.
- The current reliable certification path is:
  - deploy a Vercel preview
  - run Chrome + Firefox isolation tests against that preview
- The remaining unclosed browser-certification gap is WebKit/Safari-level runtime verification.

### Progress Estimate

- `Parallel Session Stability Hardening`: `95% complete`
- Remaining work for this front: `5%`

## 2026-03-22 - Auth startup regression gate

### What Was Added / Changed

- Added stable test selectors to [src/components/StartupOverlay.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/StartupOverlay.tsx)
- Added [tests/e2e/auth-startup.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/auth-startup.spec.mjs) covering:
  - authenticated reload without getting stuck on startup overlays
  - failed login remaining recoverable and visible in the login overlay

### Why This Matters

- The startup/session fixes are now guarded by explicit browser-level regression, not only by ad-hoc smoke testing.
- This substantially lowers the chance of reintroducing the exact startup deadlocks and auth-confirmation races we just cleaned up.

### Validation

- Preview used for certification:
  - [https://binance-trading-analysis-tool-7umguji6x.vercel.app](https://binance-trading-analysis-tool-7umguji6x.vercel.app)
- Chrome preview suite:
  - `auth-startup.spec.mjs` -> pass (`2/2`)
  - `multi-user-isolation.spec.mjs` -> pass (`2/2`)
- Firefox preview suite:
  - `auth-startup.spec.mjs` -> pass (`2/2`)
  - `multi-user-isolation.spec.mjs` -> pass (`2/2`)

### Notes For The Next Agent

- Browser certification is now strong in Chrome + Firefox for:
  - startup restore
  - login recovery
  - multi-user isolation
- The remaining browser-certification gap is specifically WebKit/Safari runtime coverage.

### Progress Estimate

- `Parallel Session Stability Hardening`: `98% complete`
- Remaining work for this front: `2%`

## 2026-03-22 - WebKit certification closure

### What Was Added / Changed

- Closed the last open browser-certification gap by running the same startup/auth and multi-user isolation suites in WebKit against the validated Vercel preview.

### Validation

- Preview used for final browser certification:
  - [https://binance-trading-analysis-tool-7umguji6x.vercel.app](https://binance-trading-analysis-tool-7umguji6x.vercel.app)
- WebKit preview suite:
  - `auth-startup.spec.mjs` -> pass (`2/2`)
  - `multi-user-isolation.spec.mjs` -> pass (`2/2`)
- Browser-certification status for this front is now green in:
  - Chrome
  - Firefox
  - WebKit

### Notes For The Next Agent

- The multi-browser certification phase for startup/session isolation is closed.
- The next logical phase is no longer browser-certification work; it is either:
  - `performance/polish`
  - or returning to bot-auto logic on top of this hardened base

### Progress Estimate

- `Parallel Session Stability Hardening`: `100% complete`
- Remaining work for this front: `0%`

## 2026-03-22 - Performance polish: bot runtime code-splitting

### What Was Added / Changed

- Added [src/components/BotRuntimeHost.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/BotRuntimeHost.tsx) as a dedicated lazy runtime host for the bot operational loop.
- Updated [src/App.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/App.tsx) so the authenticated shell lazy-loads the bot runtime instead of carrying it in the main application chunk.
- Removed the direct runtime hook from [src/components/AppView.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/AppView.tsx).

### Why This Matters

- The main bundle no longer pays for the full bot runtime path during first paint on non-bot views.
- This keeps the hardened architecture intact while improving startup weight and shell responsiveness.

### Measured Impact

- Main JS chunk dropped from `441.75 kB` to `338.31 kB`
- Gzip dropped from `125.81 kB` to `98.65 kB`

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass (`32/32`)

### Notes For The Next Agent

- This is the first concrete `performance/polish` pass after certification.
- The next best targets are the heavy shared shell hooks (`useBinanceData`, `useSignalMemory`, `useMemoryRuntime`) and any view-level polling that can be narrowed further by active screen.

### Progress Estimate

- `performance/polish`: `20% complete`
- Remaining work for this front: `80%`

## 2026-03-22 - Performance polish: refresh policy narrowing

### What Was Added / Changed

- Tightened [src/data-platform/refreshPolicy.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/data-platform/refreshPolicy.ts) so profile/account and static placeholder views no longer inherit the generic polling profile.
- Added explicit view-group branches for:
  - bot-operational views
  - profile/account views
  - static placeholder views

### Why This Matters

- Before this pass, several screens that do not need portfolio, execution, or signal-memory refresh were still paying for background polling work.
- Now:
  - profile/account views stop background polling
  - static placeholder/template views stop polling entirely
  - bot-operational views keep only targeted signal/execution refresh without unnecessary portfolio polling

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass (`32/32`)
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)

### Notes For The Next Agent

- This is the second concrete `performance/polish` pass after certification.
- The next best targets remain the heavy shared shell hooks (`useBinanceData`, `useSignalMemory`, `useMemoryRuntime`) and any additional view-level refresh that can be narrowed by active screen.

### Progress Estimate

- `performance/polish`: `35% complete`
- Remaining work for this front: `65%`

## 2026-03-22 - Performance polish: targeted connected-domain hydration

### What Was Added / Changed

- Tightened [src/hooks/useBinanceData.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useBinanceData.ts) so the connected startup path no longer hydrates full portfolio/execution/dashboard payloads indiscriminately.
- Added explicit connected-domain load plans for:
  - initial authenticated bootstrap
  - transitions into `balance`, `dashboard`, `stats`, `memory`, and `trading`

### Why This Matters

- Non-financial screens no longer pay for immediate full connected-domain hydration just because the user has an active Binance connection.
- Financial/execution-heavy screens now receive targeted data immediately instead of waiting for the next polling interval.

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass (`32/32`)
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)

### Notes For The Next Agent

- This is the third concrete `performance/polish` pass after certification.
- The next best targets remain:
  - `useSignalMemory`
  - `useMemoryRuntime`
  - any remaining shell-level synchronization that can be deferred until a view actually needs it

### Progress Estimate

- `performance/polish`: `50% complete`
- Remaining work for this front: `50%`

## 2026-03-22 - Performance polish: selective signal-memory and memory-runtime bootstrap

### What Was Added / Changed

- Tightened [src/hooks/useSignalMemory.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalMemory.ts) so the signal-memory runtime only boots immediately on views that actually consume signal memory as active product state.
- Tightened [src/hooks/useMemoryRuntime.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useMemoryRuntime.ts) so:
  - strategy runtime bootstraps immediately only on `memory` / `profile`
  - scanner runtime keeps its own slower cadence for bot-operational and control views

### Why This Matters

- The shell no longer pays for eager signal-memory and strategy-runtime hydration on every authenticated screen.
- Bot/control surfaces keep scanner freshness, while account/static surfaces stop dragging those domains into the startup path.

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass (`32/32`)
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)

### Notes For The Next Agent

- This is the fourth concrete `performance/polish` pass after certification.
- The next best targets are now:
  - `useValidationLabRuntime` gating/lazy mounting for admin-only surfaces
  - more shell-level deferral around non-visible admin tools
  - then a final UX/perf verification pass before returning to bot automation

### Progress Estimate

- `performance/polish`: `65% complete`
- Remaining work for this front: `35%`

## 2026-03-22 - Performance polish: on-demand validation lab runtime

### What Was Added / Changed

- Tightened [src/hooks/useValidationLabRuntime.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useValidationLabRuntime.ts) so validation-lab data no longer auto-hydrates during generic authenticated startup.
- Validation lab is now:
  - admin-only at the hook boundary
  - fetched on demand by the existing `Profile -> Backtesting` refresh flow

### Why This Matters

- The shell no longer pays for admin-only backtesting state unless that tooling surface is actually opened.
- This removes more non-essential startup work for both regular users and admins navigating outside backtesting.

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass (`32/32`)
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)

### Notes For The Next Agent

- This is the fifth concrete `performance/polish` pass after certification.
- The remaining work should focus on:
  - one final UX/perf verification pass
  - optional E2E spot-checks on key heavy views
  - then returning to bot automation with a lighter shell

### Progress Estimate

- `performance/polish`: `75% complete`
- Remaining work for this front: `25%`

## 2026-03-22 - Performance polish: lightweight bot count on Profile

### What Was Added / Changed

- Removed the heavy bot read-model dependency from [src/views/ProfileView.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/views/ProfileView.tsx).
- Profile now gets bot count from [src/hooks/useSelectedBot.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSelectedBot.ts) instead of loading [src/hooks/useSignalsBotsReadModel.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalsBotsReadModel.ts) just to render a storage metric.

### Why This Matters

- `Profile` is an account/admin surface, not a full bot analytics workspace.
- This pass reduces accidental coupling between the profile chunk and the heavier bot read-model dependency chain.

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass (`32/32`)
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)

### Notes For The Next Agent

- This is the sixth concrete `performance/polish` pass after certification.
- The remaining work is now mostly:
  - one final UX/perf verification pass on heavy screens
  - optional browser spot-checks
  - then returning to bot automation

### Progress Estimate

- `performance/polish`: `85% complete`
- Remaining work for this front: `15%`

## 2026-03-22 - Performance polish: isolate shell rerenders from hot market ticks

### What Was Added / Changed

- Simplified [src/hooks/useTheme.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useTheme.ts) so theme persistence only follows theme changes and no longer reruns on candle updates.
- Tightened [src/data-platform/selectors.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/data-platform/selectors.ts) so the top bar stops subscribing to unused market fields.
- Wrapped [src/components/TopBar.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/TopBar.tsx) in `memo()` with a focused prop comparison.
- Wrapped [src/components/AppView.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/AppView.tsx) in `memo()` with route-aware comparisons so the active shell no longer repaints from unrelated hot ticks.

### Why This Matters

- This is the seventh concrete `performance/polish` pass after certification.
- It reduces one of the last high-frequency costs left in the app shell:
  - global theme side effects on live candles
  - route-shell rerenders caused by hot market/runtime state that some views do not use

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run test:backend` -> pass (`32/32`)
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)

### Notes For The Next Agent

- `performance/polish` is now in final verification territory.
- The remaining work is mainly:
  - one last UX/perf spot-check on the heaviest views
  - optional browser verification on production
  - then returning to the automatic bot module

### Progress Estimate

- `performance/polish`: `95% complete`
- Remaining work for this front: `5%`

## 2026-03-22 - Repo automation: Telegram completion notification workflow

### What Was Added / Changed

- Added [notify-telegram.yml](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/.github/workflows/notify-telegram.yml) to the repo so GitHub Actions can notify Telegram on pushes to `main` and on manual dispatch.
- The workflow checks for:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
  before trying to post the message.

### Why This Matters

- Notification delivery is now repository-owned instead of living only as an untracked local file.
- Future task completions pushed to `main` can trigger Telegram notifications automatically.

### Notes For The Next Agent

- This workflow is infra/repo automation, not app runtime code.
- No frontend/backend deploy validation is required just to add the workflow, but commits to `main` should now notify Telegram once GitHub Actions picks them up.

### Progress Estimate

- Repo notification automation: `100% complete`

## 2026-03-22 - Performance polish: heavy-view browser certification closure

### What Was Added / Changed

- Added [heavy-views.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/heavy-views.spec.mjs).
- The suite covers the heaviest reachable authenticated views from the real UI:
  - `Dashboard`
  - `My Wallet`
  - `Bot Settings`
  - `Signal Bot`
  - `Profile`
  - `Profile -> Backtesting`

### Why This Matters

- This is the final verification pass for the current `performance/polish` phase.
- The project now has browser regression coverage that confirms the heaviest surfaces open and show real content in:
  - Chrome
  - Firefox
  - WebKit

### Validation

- `E2E_BASE_URL='https://binance-trading-analysis-tool-qagdrbgzn.vercel.app' PLAYWRIGHT_ENABLE_FIREFOX=1 PLAYWRIGHT_ENABLE_WEBKIT=1 npm run test:e2e -- tests/e2e/auth-startup.spec.mjs tests/e2e/multi-user-isolation.spec.mjs tests/e2e/heavy-views.spec.mjs` -> pass (`15/15`)

### Notes For The Next Agent

- `performance/polish` can now be treated as closed for this phase.
- The next recommended focus is the automatic bot module, now that:
  - backend/system audit is green
  - multi-user startup/browser certification is green
  - heavy-view browser certification is green

### Progress Estimate

- `performance/polish`: `100% complete`

## 2026-03-22 - Focused sidebar navigation for current product phase

### What Was Added / Changed

- Simplified [src/components/Sidebar.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/Sidebar.tsx) so the visible menu now shows only:
  - `Dashboard`
  - `My Wallet`
  - `Bot Settings`
  - `Signal Bot`
- Preserved the broader future navigation structure in code as [SIDEBAR_FUTURE_SECTION_GROUPS](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/Sidebar.tsx) instead of deleting it.
- Removed the lower sidebar action buttons from the visible UI.
- Added top-right user-menu hooks in [src/components/TopBar.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/components/TopBar.tsx) for:
  - `Account Settings`
  - `Cerrar sesión`
- Updated affected E2E flows to use the new topbar path.

### Why This Matters

- Product navigation is now intentionally focused on the active module set instead of exposing half-finished or parked sections in the sidebar.
- The hidden future sections are still preserved in code and can be restored later without recovering deleted view files.

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass

### Notes For The Next Agent

- This is a UX/navigation cleanup, not a deletion of future app surfaces.
- If the product later wants to re-expand the sidebar, start from `SIDEBAR_FUTURE_SECTION_GROUPS` instead of rebuilding the map from scratch.

### Progress Estimate

- Focused navigation cleanup: `100% complete`

## 2026-03-22 - Focused sidebar browser recertification

### What Was Added / Changed

- Updated [heavy-views.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/heavy-views.spec.mjs) to assert the current `My Wallet` copy:
  - `Total Portfolio Value`
  - `Asset Holdings`
- Kept [multi-user-isolation.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/multi-user-isolation.spec.mjs) aligned with the direct `Bot Settings` link in the simplified sidebar.

### Why This Matters

- The simplified sidebar is now fully recertified in browser tests against the real copy and real navigation shape.
- This removes stale test expectations from the pre-focused wallet screen and keeps the regression suite trustworthy.

### Validation

- `E2E_BASE_URL='https://binance-trading-analysis-tool-qagdrbgzn.vercel.app' PLAYWRIGHT_ENABLE_FIREFOX=1 PLAYWRIGHT_ENABLE_WEBKIT=1 npm run test:e2e -- tests/e2e/auth-startup.spec.mjs tests/e2e/multi-user-isolation.spec.mjs tests/e2e/heavy-views.spec.mjs` -> pass (`15/15`)

### Notes For The Next Agent

- Treat the focused sidebar as certified in:
  - Chrome
  - Firefox
  - WebKit
- If the wallet copy changes again, update [heavy-views.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/heavy-views.spec.mjs) instead of reintroducing stale labels from older portfolio screens.

### Progress Estimate

- Focused sidebar browser recertification: `100% complete`

## 2026-03-22 - Automatic bot certification and contract hardening

### What Was Added / Changed

- Introduced [src/domain/bots/operationalLoop.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/domain/bots/operationalLoop.ts) to host pure automatic-bot loop rules that were previously embedded in [useBotOperationalLoop.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useBotOperationalLoop.ts).
- Hardened [api/_lib/bots.js](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/api/_lib/bots.js) so persisted bot rows now:
  - normalize before guardrails
  - self-heal invalid legacy payloads during hydration
  - repair automation/policy drift during `listBots`
- Expanded backend regression:
  - [bot-operational-loop.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/bot-operational-loop.test.mjs)
  - [bots-contract.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/bots-contract.test.mjs)
  - [system-audit.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/system-audit.test.mjs)
- Extended [system-audit.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/scripts/system-audit.mjs) so it now reports `botAutomation` consistency per user and fails when stored bots drift away from their expected execution policy contract.
- Added browser regression [auto-bot.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/auto-bot.spec.mjs) and stable UI hooks in [SignalBotView.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/views/SignalBotView.tsx) to validate the `Auto-Execute` toggle end-to-end.
- Repaired real persisted bot rows for `jeremias` and `yeudy` so the stored data now matches the hardened auto/observe policy rules.

### Why This Matters

- This is the first time the automatic bot flow is certified across:
  - backend contract
  - persisted data
  - system audit
  - browser UI
- The toggle is no longer “just a visual switch”; it is now verified as a policy transition with reload persistence and normalized backend truth.

### Validation

- `npm run test:backend` -> pass (`43/43`)
- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npm run system-audit -- --env-file=/tmp/crype-bot-audit.env --users=jeremias,yeudy` -> pass (`findings: []`)
- `E2E_BASE_URL='https://binance-trading-analysis-tool-5avdmvdc8.vercel.app' npm run test:e2e -- --project=chrome tests/e2e/auto-bot.spec.mjs` -> pass
- `PLAYWRIGHT_ENABLE_FIREFOX=1 E2E_BASE_URL='https://binance-trading-analysis-tool-5avdmvdc8.vercel.app' npm run test:e2e -- --project=firefox tests/e2e/auto-bot.spec.mjs` -> pass
- `PLAYWRIGHT_ENABLE_WEBKIT=1 E2E_BASE_URL='https://binance-trading-analysis-tool-5avdmvdc8.vercel.app' npm run test:e2e -- --project=webkit tests/e2e/auto-bot.spec.mjs` -> pass

### Notes For The Next Agent

- Treat the automatic bot toggle as certified for this phase:
  - Chrome
  - Firefox
  - WebKit
- If a future regression appears in auto mode, start from:
  - [src/domain/bots/operationalLoop.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/domain/bots/operationalLoop.ts)
  - [api/_lib/bots.js](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/api/_lib/bots.js)
  - [tests/e2e/auto-bot.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/auto-bot.spec.mjs)
- The next sensible focus after this certification is product behavior quality:
  - auto-execution rules
  - bot-visible UX
  - history/log semantics

### Progress Estimate

- Automatic bot certification: `100% complete` for this phase

## 2026-03-22 - Signal Bot activity surface split from trade history

### What Was Added / Changed

- Added a dedicated `Bot Activity` tab inside [SignalBotView.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/views/SignalBotView.tsx).
- `Signal History` remains tied to canonical trades only.
- `Bot Activity` now renders non-trade operational handling from `selectedBotActivityTimeline`, while excluding anything already represented in the canonical `tradeTimeline`.
- Covered the new visible surface in [heavy-views.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/heavy-views.spec.mjs).
- Styled the new table in [content.css](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/styles/content.css) with the same tone system used by the existing history pills.

### Why This Matters

- This closes a product gap left after cleaning `Signal History`: users now have an explicit place to understand non-executed signal handling without mixing those rows back into trade history.
- The user-facing bot workspace is now semantically cleaner:
  - `Active Signals` = opportunities
  - `Signal History` = trades
  - `Bot Activity` = operational explanations
  - `Bot Settings` = control surface

### Validation

- `npm run typecheck` -> pass
- `npm run build` -> pass
- `E2E_BASE_URL='https://binance-trading-analysis-tool-82xd6ko0t.vercel.app' PLAYWRIGHT_ENABLE_FIREFOX=1 PLAYWRIGHT_ENABLE_WEBKIT=1 npm run test:e2e -- tests/e2e/heavy-views.spec.mjs` -> pass (`3/3`)
- `E2E_BASE_URL='https://binance-trading-analysis-tool-82xd6ko0t.vercel.app' npm run test:e2e -- --project=chrome tests/e2e/auto-bot.spec.mjs` -> pass

### Notes For The Next Agent

- If the product later wants a deeper operational surface, build from `selectedBotActivityTimeline` or [ExecutionLogsView.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/views/ExecutionLogsView.tsx), but do not move blocked/reviewed rows back into `Signal History`.
- `auto-bot.spec.mjs` mutates real persisted bot state. Keep it as a per-project/browser certification smoke, not a simultaneous multi-browser toggle run against the same bot.

### Progress Estimate

- Signal Bot history/activity semantic split: `100% complete` for this phase

## 2026-03-22 - Bot Settings live refresh warm-up fix

### What Was Added / Changed

- Extracted connected-view warm-up orchestration into [connectedLoadPlan.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/data-platform/connectedLoadPlan.ts).
- Updated [useBinanceData.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useBinanceData.ts) to consume that shared load plan.
- Bot operational surfaces now request `execution center` immediately on entry instead of waiting for the next interval tick.
- Added deterministic coverage in [binance-view-load-plan.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/binance-view-load-plan.test.mjs).
- Added browser smoke coverage in [bot-settings-refresh.spec.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/e2e/bot-settings-refresh.spec.mjs).

### Why This Matters

- The stale `Bot Settings` KPI/card issue was rooted in view orchestration, not in the bot cards themselves.
- The app now treats bot operational views as execution-driven surfaces during startup and navigation, which keeps `Bot Settings` aligned with the same hot data used by `Signal Bot` and `Execution Logs`.

### Validation

- `npm run test:backend` -> pass (`47/47`)
- `npm run typecheck` -> pass
- `npm run build` -> pass

### Notes For The Next Agent

- Prefer fixing future live-refresh issues by adjusting [connectedLoadPlan.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/data-platform/connectedLoadPlan.ts) or [refreshPolicy.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/data-platform/refreshPolicy.ts), not by inserting view-local polling.
- Local Playwright browser launch was unstable during this run, so the pure load-plan regression is the current trusted gate for this specific issue.

### Progress Estimate

- Bot Settings live-refresh warm-up issue: `100% complete`

## 2026-03-22 - Bot module warm-up audit and stale-first-paint fix

### What Was Added / Changed

- Introduced [botWorkspaceBootstrap.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/data-platform/botWorkspaceBootstrap.ts) to define which views should warm the bot workspace domains.
- Added [useBotRuntimeHydration.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useBotRuntimeHydration.ts) and mounted it in [App.tsx](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/App.tsx).
- Bot operational views now force-refresh:
  - bot registry
  - bot decisions
  - shared signal memory
- Updated [useSignalMemory.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useSignalMemory.ts) so `control-bot-settings` is no longer excluded from shared signal bootstrap.
- Added coverage in [bot-workspace-bootstrap.test.mjs](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/tests/backend/bot-workspace-bootstrap.test.mjs).

### Why This Matters

- The user-reported stale first paint affected more than one bot screen because the module did not warm all of its shared domains together.
- The bot module now enters operational views as a coherent workspace rather than waiting for a later poll or unrelated request to repair the state.

### Validation

- `npm run test:backend` -> pass (`51/51`)
- `npm run typecheck` -> pass
- `npm run build` -> pass

### Notes For The Next Agent

- If a future bot surface looks stale on first paint, inspect [botWorkspaceBootstrap.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/data-platform/botWorkspaceBootstrap.ts) and [useBotRuntimeHydration.ts](/Users/jeremiasmoncion/Documents/New project/binance-trading-analysis-tool/src/hooks/useBotRuntimeHydration.ts) before touching the view itself.
- Keep bot warm-up orchestration centralized. Do not reintroduce view-local emergency polling.

### Progress Estimate

- Bot module stale-first-paint warm-up issue: `100% complete`
