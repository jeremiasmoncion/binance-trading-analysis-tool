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
