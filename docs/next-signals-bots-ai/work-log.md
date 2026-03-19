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
