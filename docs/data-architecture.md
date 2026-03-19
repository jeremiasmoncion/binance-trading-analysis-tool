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

- binance connection
- portfolio snapshot
- execution center
- dashboard summary overlays
- signal memory
- watchlists

Lifecycle:

- full snapshot from backend
- lightweight operational overlays
- later: live events from persistent realtime core

## Rules

1. `App` is the synchronization boundary for live business data.
2. Views consume shared planes or selectors from them.
3. Supabase is persistence, not the primary hot path for live UI.
4. Vercel APIs are for cold/admin/reporting and temporary summary composition.
5. Realtime-sensitive UI should prefer overlays and diffs over full payload replacement.

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

### In Progress

- migrate remaining views to selector-first shared consumption
- move local logic that still polls by screen toward plane-owned policies
- prepare the bridge from snapshots to event-driven overlays

### Pending

- remove serverless from the hot operational path
- introduce persistent realtime core service
- move shared planes from snapshot-heavy updates to event-driven overlays
- split hot operational data from cold/admin/reporting paths
