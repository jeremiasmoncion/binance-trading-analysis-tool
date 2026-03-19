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
