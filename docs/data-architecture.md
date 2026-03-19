# CRYPE Data Architecture

## Objective

CRYPE now standardizes data consumption around a single application-wide architecture.

The goal is:

- one shared data contract for the whole app
- one synchronization layer at app level
- reusable data planes for market data and system data
- no new screen should invent its own fetch model
- realtime UX should move toward `snapshot + event stream + overlays`

## Current Shared Planes

### Market Data Plane

Source of truth for:

- coin and timeframe
- candles
- current price
- indicators
- signal and analysis
- strategy and candidates
- comparison list
- 24h market context

Lifecycle:

- full snapshot on fetch
- overlay updates from websocket streams
- derived state updated centrally

### System Data Plane

Source of truth for:

- `snapshot`
  - binance connection
  - portfolio snapshot
  - signal memory
  - watchlists
- `overlay`
  - execution center
  - dashboard summary overlays
- `controls`
  - portfolio period
  - hide-small-assets state
  - available users
  - binance form state
- `actions`
  - refresh / connect / disconnect / control handlers exposed to views

Lifecycle:

- full snapshot from backend
- lightweight operational overlays
- UI control state synchronized centrally
- user actions exposed through the plane instead of ad-hoc prop chains
- later: live events from persistent realtime core

## Rules

1. `App` is the synchronization boundary for live business data.
2. Views consume shared planes or selectors from them.
3. Supabase is persistence, not the primary hot path for live UI.
4. Vercel APIs are for cold/admin/reporting and temporary summary composition.
5. Realtime-sensitive UI should prefer overlays and diffs over full payload replacement.

## Realtime Bootstrap Flow

Current bootstrap path:

1. `App` requests `/api/realtime/bootstrap`
2. the route composes a cold bootstrap for:
   - market snapshot
   - portfolio snapshot
   - execution overlay
   - dashboard overlay
   - signal memory
   - watchlists
3. frontend applies the payload to `market` and `system` planes through `applyRealtimeCoreBootstrap`
4. existing hooks continue refreshing snapshots and overlays until the persistent realtime core replaces this hot path

This means the app already has:

- one standard bootstrap contract
- one standard hydration path
- one explicit bridge between cold snapshot loading and future event streams

## Realtime Overlay Flow

Current live overlay path:

1. frontend opens `/api/realtime/events`
2. the route emits `system.overlay.updated`
3. frontend applies the event through `applyRealtimeCoreEvent`
4. shared `system` plane updates `connection + portfolio live + execution + dashboard summary`
5. selector-based views receive the overlay without rebuilding the whole app state

This is still transitional:

- the Vercel route still exists as fallback
- the external realtime core now supports hot in-memory per-user channels
- it still coexists with polling
- it exists to lock the contract and frontend flow before moving all hot runtime ownership to the persistent realtime core

## External Realtime Core Mode

The frontend can now consume an external persistent realtime core service through:

- `VITE_REALTIME_CORE_URL`

When this env is present:

- frontend first requests `/api/realtime/session` on the app domain
- bootstrap requests go to the external realtime core service with a bridge token
- event stream requests go to the external realtime core service with the same bridge token
- frontend contracts stay the same

This allows infrastructure migration without rewriting view logic.

Current reduction already applied:

- `Dashboard` no longer polls `execution` and `dashboard summary` on an interval while the overlay stream is active
- `Memory` no longer polls `execution` on an interval while the overlay stream is active
- `signal memory` now publishes into the shared `system plane` directly instead of depending only on `App` sync
- `Dashboard` no longer runs periodic `signal memory` refreshes
- `Memory` keeps a slower `signal memory` refresh cadence while the realtime migration continues
- `Dashboard` now refreshes portfolio on `live` mode with a slower cadence and leans more on dashboard summary for top assets
- `Dashboard` portfolio live totals now arrive through the overlay stream, so the view no longer polls portfolio on an interval
- portfolio snapshots still refresh independently because they are not yet on the overlay stream

## Migration Phases

### Completed

- global contracts for market and system planes
- central stores for both planes
- app-level synchronization entrypoint
- dashboard, memory and balance consuming shared planes
- stats, trading and market consuming shared planes
- support/resistance moved into market plane
- reduced prop-driven live state in `AppView`
- shared selectors for primary view domains
- centralized refresh policy for market/system/signal planes
- system plane split into `snapshot + overlay + controls + actions`
- balance, memory and profile actions can now resolve from the shared plane

### In Progress

- migrate remaining views to selector-first shared consumption
- move local logic that still polls by screen toward plane-owned policies
- bootstrap route for realtime core foundation (`/api/realtime/bootstrap`)
- shared realtime contracts and bootstrap hydration for market/system planes
- bridge auth from the app domain to the external realtime core
- persistent-memory per-user overlay channels in the external realtime core
- deployment assets for a persistent containerized realtime core

### Pending

- remove serverless from the hot operational path
- introduce persistent realtime core service
- move shared planes from snapshot-heavy updates to event-driven overlays
- split hot operational data from cold/admin/reporting paths
