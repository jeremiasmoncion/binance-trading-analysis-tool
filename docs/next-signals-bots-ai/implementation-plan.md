# Implementation Plan

## Guiding Principle

Do not attempt to build the entire redesign in one pass.

Each phase must end with:

- code that still makes sense
- a stable partial deliverable
- updated documentation
- a clear next step

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

## Phase 4 - Signal Core Separation

Goals:

- separate global signal feeds from bot-consumable signals
- define signal feed taxonomy
- prepare ranking/prioritization

Suggested deliverables:

- signal feed contracts
- classification pipeline
- feed selectors or service layer

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

## Recommended Working Rule

No phase is complete until:

- docs are updated
- handoff is updated
- next phase is identified
