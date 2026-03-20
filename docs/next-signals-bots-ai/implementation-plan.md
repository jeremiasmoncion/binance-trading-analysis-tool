# Implementation Plan

## Guiding Principle

Do not attempt to build the entire redesign in one pass.

Each phase must end with:

- code that still makes sense
- a stable partial deliverable
- updated documentation
- a clear next step

## UX Architecture Rule

The product UX is no longer freeform.

The local `TradeBotX` template defines the target navigation flow, submenu hierarchy, page grouping, and layout distribution for the redesign.

Implementation should now follow the template flow exactly unless a deviation is explicitly documented and justified.

The authoritative UX architecture is documented in:

- `docs/next-signals-bots-ai/user-experience-architecture.md`

This includes:

- sidebar hierarchy
- page/subpage distribution
- expected tab structure
- use of cards, tables, charts, forms, and drawers
- end-user information minimization rules
- separation of user-facing vs technical/admin surfaces

## Phase 1 - Discovery and Documentation

Goals:

- map current architecture
- identify reusable modules
- identify weak points
- establish documentation set

Deliverables:

- this documentation folder
- current-state analysis
- target architecture draft
- work log initialized

## Phase 2 - Domain Model Foundation

Goals:

- introduce explicit bot domain language
- define contracts for bot policy, environments, modes, memory, and overlap
- document domain boundaries

Suggested implementation targets:

- new shared types
- new domain contracts
- minimal storage/state scaffolding

Deliverables:

- bot domain types
- policy enums/records
- environment/mode model
- overlap model base

## Phase 3 - Bot Core Foundation

Goals:

- create first-class bot entities
- support watchlist or custom-list universe
- support execution environment and automation mode
- support isolated accounting and tracking

Suggested deliverables:

- bot store/domain layer
- persistence model or structured in-memory contract
- initial bot lifecycle actions
- first user-facing bot page architecture
- bot-list-first UX with create-bot entry point
- page flow aligned with template `Control Panel -> Bot Settings`
- search, chips, card grid, and edit-drawer behavior aligned with template

Current validated state:

- first persisted bot registry seam exists
- first real bot create/update path exists
- selected bot travels through a shared seam into the full bot workspace
- quick edit now writes into the same persisted bot registry seam

## Phase 3.5 - Bot Decision And Activity Layer

Goals:

- stop treating bot performance as only pair-scoped inference
- introduce dedicated bot decision/activity records
- prepare execution logs and training on top of real bot-owned history

Suggested deliverables:

- bot decision contract
- bot activity persistence seam
- bot history read-model
- first real bridge between consumed signals and bot-owned outcomes
- phase-safe metrics path for:
  - history
  - performance
  - training

Current progress:

- done:
  - bot decision contract
  - bot decision API seam
  - shared frontend bot decision runtime
  - first Signal Bot actions writing manual decisions
  - first Execution Logs integration for decision records
- pending:
  - Supabase `bot_decisions` table
  - richer bot-owned outcomes and performance aggregation
  - persistence for platform-wide bot settings tabs

Suggested first implementation rule:

- reuse persisted `signalMemory` where useful
- but do not collapse bot history back into raw signal snapshots once bot decisions become available

## Phase 4 - Signal Core Separation

Goals:

- separate global signal feeds from bot-consumable signals
- define signal feed taxonomy
- prepare ranking/prioritization

Suggested deliverables:

- signal feed contracts
- classification pipeline
- feed selectors or service layer
- first dedicated user-facing signals page architecture
- watchlist vs market-discovery UX split
- page flow aligned with template `AI Bot -> Signal Bot`
- active-signals-first surface with lower supporting insight blocks

Current progress:

- done:
  - shared `market + signal core` seam
  - explicit feed subsets exposed from one hook:
    - watchlist
    - market-wide
    - operable
    - bot-consumable
  - `SignalsView` now reads those feeds from the shared seam
  - `signals + bots` read-model now consumes that seam instead of rebuilding the feed pipeline alone
  - `operable` now prefers real eligible `execution candidates` from the shared execution overlay
  - `bot-consumable` can now hydrate from that stronger operable cohort before falling back to ranked memory feeds
  - scanner discovery context is now exposed from the same seam for watchlist-driven product surfaces
  - explicit operational cohorts now exist in the signal seam:
    - eligible
    - blocked
    - observational
- pending:
  - connect market-wide feeds more directly to backend scanner flows beyond active execution candidates
  - deepen the operable contract with richer scanner/runtime context and later AI-prioritized slices
  - route more surfaces through `Signal Core` instead of direct signal-memory derivation

## Phase 4.5 - UX Flow Migration

Goals:

- replace legacy end-user flow with template-matching navigation
- stop treating old `Signal Bot` as the main product delivery surface
- align sidebar, submenus, tabs, and page composition with the template
- preserve CRYPE's migrated visual line while matching the template structure exactly

Suggested deliverables:

- sidebar hierarchy matching the template
- `Control Panel` subpages:
  - `Overview`
  - `Bot Settings`
  - `Execution Logs`
- `AI Bot` subpages:
  - `Signal Bot`
  - `DCA Bot`
  - `Arbitrage Bot`
  - `Pump Screener`
- dedicated page compositions for:
  - `Bot Settings`
  - `Execution Logs`
  - `Signal Bot`
- end-user information simplified and technical detail withheld or translated

## Phase 5 - AI and Governance Integration

Goals:

- map AI roles
- connect governance to bot policies
- prepare unrestricted AI bot policy safely
- reinforce real-execution guardrails

Suggested deliverables:

- AI policy contracts
- governance integration points
- execution restrictions by environment

## Phase 6 - Performance and Learning Integration

Goals:

- bot-level performance summaries
- signal-level and bot-level learning separation
- family/global learning preparation

Suggested deliverables:

- performance summary contracts
- learning snapshot boundaries
- aggregation paths

## Phase 7 - Conversational Future Preparation

Goals:

- document future chat assistant architecture
- expose system actions in structured form
- avoid implementation patterns that block this future

Deliverables:

- assistant action inventory
- future integration notes

## Risks

### Risk 1

Trying to turn current scanner/execution behavior into “bots” without an explicit bot domain model first.

### Risk 2

Mixing signal feed redesign and execution redesign in the same uncontrolled step.

### Risk 3

Letting unrestricted AI mode break accounting isolation.

### Risk 4

Adding market-wide signal feeds without ranking discipline, creating noise.

### Risk 5

Continuing to grow the legacy `Signal Bot` page instead of replacing it with a clearer end-user page structure modeled on the template UX.

### Risk 6

Treating the template as loose inspiration instead of as the official UX flow standard, causing inconsistent menus, tabs, or page hierarchy.

### Risk 7

Exposing too much technical bot/signal information directly to end users instead of translating it into simpler product language.

## Recommended Working Rule

No phase is complete until:

- docs are updated
- handoff is updated
- next phase is identified
