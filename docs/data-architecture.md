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
  - watchlist mutations exposed through the plane

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
- frontend probes the external `/health`
- bootstrap requests go to the external realtime core service with a bridge token
- event stream requests go to the external realtime core service with the same bridge token
- if the external service is unhealthy or fails, frontend falls back to Vercel routes
- frontend contracts stay the same
- the active runtime mode is synchronized into the shared `system plane`, so any view can inspect whether CRYPE is currently on `external` or `serverless`
- `App` now supervises runtime health centrally and can notify when the app switches between `external core` and `serverless fallback`

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

## Startup and Initial Paint

The authenticated shell should not render before the minimum startup payload is ready.

Current rule:

- after session restore, login or register, `App` gates the authenticated UI behind a startup overlay
- the initial gate waits for:
  - realtime bootstrap hydration
- bootstrap is now intentionally system-first during startup; market data hydrates through the dedicated market fetch instead of duplicating a second market snapshot inside the same first-paint request
- the first market load now continues in the background after the authenticated shell is ready, so startup latency is driven by `system` readiness instead of the heaviest market calculation path
- this prevents the dashboard from painting with temporary `$0.00` placeholders and then filling one or two seconds later

Auth flow rule:

- `useAuth` must not publish `currentUser` before the startup bootstrap callback completes
- this now applies to both:
  - login/register
  - restored sessions on first load
- if a future auth flow bypasses that order, it will reintroduce the empty-first-paint bug

## Snapshot vs Overlay Rules

The app is now stricter about which layer can overwrite which state.

Current rules:

- realtime/bootstrap state is allowed to establish a better `system` state before legacy hooks finish
- legacy sync from `useBinanceData` must not overwrite an existing good `system plane` value with `null` or an empty payload
- `signal memory` follows the same `last good state` principle as `dashboard summary` and `execution`
- `dashboardSummary.topAssets` is also part of that `last good state` rule; a lightweight summary may legitimately omit the collection, but it must not blank the dashboard assets card if a previous good list already exists
- transient fetch failures should degrade status, not blank the UI

This means:

- `snapshot.portfolio` should survive weak legacy sync frames
- `snapshot.portfolio` should also reject live frames that collapse a previously non-cash portfolio into cash-only coverage; lightweight live reads may be partial, but they must not fabricate a fake drawdown by dropping all open positions for one cycle
- `snapshot.portfolio` and `overlay.dashboardSummary` should also reject near-cash collapses where one tiny asset survives but the portfolio still drops from diversified holdings to almost pure cash in a single live frame
- `overlay.execution` should survive degraded overlay frames
- `overlay.dashboardSummary` should survive degraded overlay frames
- `snapshot.signalMemory` should survive transient list failures
- `signal memory` refresh should be no-op aware too; repeated shared refreshes must not republish the same signal list just because the backend returned a new array reference
- shared signal-memory hydration should not refetch on every screen navigation; because the hook lives at App level, navigation-only changes must defer to refresh policy and explicit mutations instead of reopening the same list fetch
- shared `memory runtime` refreshes should be no-op aware as well; strategy/scanner polling can remain centralized, but equivalent payloads must not recreate the canonical engine snapshot on every interval
- shared `memory runtime` strategy polling should also be view-adaptive; `Memory` and `Profile` can keep a tighter cadence, while the rest of the shell should use a slower shared heartbeat so automation recommendations stay fresh without paying the same global polling cost on every screen
- shared validation-lab runtime should be no-op aware too; admin actions may legitimately return the same report/runs/queue snapshot, and those equivalent responses must not churn the `system plane` just because the backend recreated the objects
- `useBinanceData` refreshes should also be no-op aware for connection, execution and dashboard summary payloads; shared runtime hooks may poll or refresh for safety, but they should not wake the `system plane` when those operational payloads are semantically unchanged
- `dashboardSummary` no-op checks must ignore freshness-only metadata such as `generatedAt`; shared dashboard surfaces should wake up only when portfolio, top-assets or execution content actually changes
- profile/runtime sync should also avoid equivalent control writes; for example, account alias hydration from connection refresh must not rewrite the Binance form when the alias string is already current
- `ExecutionCenterPayload` comparators must stay semantic as the template grows more tabs, cards and tables; equality should live in shared runtime infrastructure and compare profile policy arrays, scope overrides, candidate cohorts and recent-order cohorts instead of shallow length/first-row checks
- external realtime bootstrap and overlays must resolve system data from the already-authenticated username/session, not from same-origin request cookies
- frontend bootstrap fallback is now quality-aware: if the external realtime core answers but the first payload is degraded by upstream exchange issues, CRYPE falls back to the internal bootstrap before rendering the authenticated workspace
- bootstrap composition must derive `portfolio`, `execution` and `dashboard summary` from one canonical account snapshot whenever possible; first paint should not fan out multiple full account reads for the same user
- serverless fallback routes that still read Binance directly must stay pinned to a region that Binance Demo actually serves; a lower-latency region is not useful if it produces degraded startup payloads

## Transitional Legacy Boundaries

CRYPE is still in a hybrid migration, so these boundaries are important:

- `AppView` should keep shrinking its prop surface as views move to selector-first consumption
- market navigation actions should live in the shared `market plane`; views like `Compare` and `Market` should not depend on direct prop wiring just to switch coin/timeframe
- global chrome such as `TopBar` should also read hot market/runtime state from shared selectors when possible; `App` should forward local UI actions, not rebroadcast the same market payload tree through props
- shell-level view controls should keep stable callback identities; the top tree (`App`, `Sidebar`, `TopBar`, `AppView`) should not rebroadcast new navigation handlers on every unrelated market/system update
- top-level action props should follow the same rule; commands like `onSaveSignal` should be stabilized in `App` instead of being recreated inline on every render
- selector-first market views should not depend on `AppView` props just to change the active coin; once a market action lives in the shared plane, views like `Market` and `Compare` should consume it there
- selector-first screen modules should also drop compatibility wrappers once `AppView` no longer passes those props; `Dashboard` and `Profile` should read operational state directly from shared selectors and keep props only for truly local concerns like user identity or a chart ref
- selector-first screens should also delete dead prop-compatibility layers once `AppView` stops wiring them; `Market`, `Stats`, `Trading` and `Memory` should not keep `incomingProps ?? selector` wrappers for state that now only comes from the shared planes
- template pages that are mostly read-only, like `Signal Bot` and `Bot Settings`, should also subscribe through fine-grained selectors instead of broad runtime bundles; if a surface only needs `signalMemory + watchlists`, it must not wake up on scanner, execution or admin-state churn
- watchlist mutations should flow through `system plane actions`, not through screen-specific prop chains
- watchlists should treat `localStorage` as a startup cache and last-good fallback only; once a user has a remote session, the remote payload remains canonical and optimistic local edits should reconcile back through that same remote path
- shared watchlist hydration and remote sync should be no-op aware too; cache hydration and remote echoes may recreate the same lists with fresh references, and those equivalent payloads must not churn the `system plane`
- per-screen polling is considered transitional debt and should be removed or limited to explicit, local-only admin behaviors
- global automation notifications should observe the shared memory-runtime snapshot, not open a second App-level polling loop straight to the strategy service
- realtime-core runtime supervision in `App` should be adaptive too; fallback or unhealthy states can keep a tighter health cadence, but a healthy external core should back off to a slower shared probe instead of behaving like a permanent high-frequency poll on every authenticated screen
- `MemoryView` now scopes its strategy/scanner polling to tabs that actually use that data instead of polling unconditionally in the background
- `MemoryView` strategy-engine and scanner data now hydrate through the shared `system plane`; only the tab-aware heartbeat remains local while that screen still decides which subsection is visible
- `signal memory` client-side evaluation must not open parallel market reads; it can only use prices already present in the shared `market plane`, while off-screen coins remain the responsibility of the backend watcher
- App-level client market automations should only run on screens that actively consume the hot market context; background monitoring for off-screen coins belongs to the backend watcher/runtime, not to a global effect in the shell
- scanner admin refresh/run actions should resolve through shared `system plane actions`, even when the final execution summary is rendered only in admin screens like `Perfil` or `Memory`
- `useBinanceData` should keep any remaining per-view warm-up logic behind a single load-plan helper; if that behavior needs to change, it should be updated in one place instead of reintroducing screen-specific refresh branches across multiple effects
- profile backtesting controls should resolve through shared `system plane` state/actions; `ProfileView` should not own a second validation-lab fetch cycle
- strategy engine mutations used by `MemoryView` should resolve through shared `system plane actions`; the view can keep local form state, but it should not own the canonical mutation pipeline
- demo execution mutations used by `MemoryView` should resolve through shared `system plane actions`; the view can keep local draft state and UX toasts, but not own the operational request path
- manual signal-memory mutations used by `MemoryView` should also resolve through shared `system plane actions`; the view should not depend on a separate prop callback for closing or annotating saved signals
- market-plane sync should be no-op aware; if the market hook re-renders without a meaningful payload change, the plane should keep the same object so selectors do not wake up for identical state
- action sync into shared planes should also be no-op aware; repeated App sync passes must not recreate market/system action objects when handler references did not actually change
- market hooks should prefer a compact derived snapshot over many sibling state setters; fetch and stream updates can still be frequent, but they should fan into one market payload instead of a long list of local writes
- high-frequency market paths should be no-op aware locally too; symbol-universe hydration and live ticker frames should not write React state again when the effective payload is unchanged
- periodic market refreshes should stay background-friendly too; once a good market snapshot exists, silent refresh failures should not bounce the shared plane back through `loading/error` unless the user is actually switching coin or timeframe
- live kline processing should reject fully identical candle frames too; websocket noise is normal, and the market plane should not rerun indicator + strategy derivation if the last visible candle has not changed at all
- derived market collections exposed to shared sync, like `popularCoins`, should keep stable references too; if the contents are the same, the hook should memoize them so the market plane can actually treat the sync as a no-op
- realtime overlay application should be no-op aware too; identical `system.overlay.updated` frames and routine heartbeats must not recreate shared system state, especially as future bot runtime increases the frequency and size of operational overlays
- emit-side realtime deduplication should be semantic too; the persistent core may keep freshness timestamps in the payload for operators, but overlay hashes must ignore volatile `generatedAt/updatedAt` fields so higher-frequency bot and AI feeds do not fan out equivalent overlays
- market snapshots should follow a latest-request-wins rule; if the user changes coin or timeframe quickly, older responses must be ignored instead of snapping the plane back to stale context
- market derivation should have one canonical helper path; fetches and live streams can enter through different sources, but they should build signal/analysis/strategy state with the same snapshot pipeline
- market derivation should also reuse any indicator pass that already happened in the active path; the hot kline/ticker loop should not recalculate the same candle indicators twice before running the strategy engine
- market comparison should behave like shared 24h context, not like a per-timeframe dependency; market refreshes can reuse a short-lived comparison snapshot and live comparison frames should no-op when price/change data did not actually move
- market comparison is now scoped to the dedicated comparison surface; `Market` should not keep a comparison fetch/stream alive when only `Compare` consumes that context
- market symbol-universe hydration should also behave like shared context; changing between market-oriented views should reuse a short-lived universe cache instead of refetching the same symbol list on every navigation
- multi-timeframe market context should refresh the active timeframe from fresh candles while reusing a short-lived cache for the surrounding timeframes; one market refresh should not fan out a full non-active timeframe batch every time

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
- market refresh policy now sets a real per-view cadence ceiling instead of acting as a boolean switch
- heavy market comparison and symbol-universe reads are now skipped outside the views that actually need them
- a market refresh should never request the active timeframe candles twice; multi-timeframe context must reuse the canonical active snapshot from the same cycle
- system plane split into `snapshot + overlay + controls + actions`
- balance, memory and profile actions can now resolve from the shared plane
- market watchlist editing now resolves through `system plane actions`, so `MarketView` no longer needs a dedicated watchlist mutation prop path from `App`
- memory tooling reads now resolve through `system plane snapshot + actions`, so `MemoryView` no longer owns separate local copies of strategy-engine and scanner state
- signal-memory evaluation now reuses shared market state instead of calling market APIs per pending coin from the browser
- profile scanner controls now consume shared scanner state/actions instead of calling the watchlist service directly from the view
- profile backtesting now consumes shared validation-lab state/actions instead of calling the strategy engine directly from the view
- memory strategy experiments and recommendation actions now resolve through shared `system plane` actions instead of calling the strategy engine directly from the view
- memory execution profile, demo execution and post-fill protection actions now resolve through shared `system plane` actions instead of calling Binance services directly from the view
- memory saved-signal updates now resolve through shared `system plane` actions instead of a direct callback prop from `App`
- market-plane sync now skips no-op writes and tracks support/resistance changes explicitly so market selectors only wake up on real payload changes
- market derived state now travels through a compact local snapshot inside `useMarketData`, reducing setter fan-out before the plane sync even runs
- symbol-universe hydration and live ticker updates inside `useMarketData` now skip identical writes, trimming more invisible render work before sync reaches the plane
- market fetches now ignore stale responses from older coin/timeframe requests, so rapid navigation cannot overwrite the latest market context with a slower previous payload
- `useMarketData` now derives signal/analysis/strategy state through a single helper shared by fetch and live-stream updates, reducing duplicated logic before future optimizations move more work off the client
- live market derivation now reuses the already computed active-timeframe indicators before entering the shared derivation helper, trimming duplicate work from the hottest path

### In Progress

- migrate remaining views to selector-first shared consumption
- move local logic that still polls by screen toward plane-owned policies
- bootstrap route for realtime core foundation (`/api/realtime/bootstrap`)
- shared realtime contracts and bootstrap hydration for market/system planes
- bridge auth from the app domain to the external realtime core
- persistent-memory per-user overlay channels in the external realtime core
- deployment assets for a persistent containerized realtime core
- cutover readiness command for external realtime activation
- preflight validation for realtime-core cutover
- smoke validation for bridge token, bootstrap and SSE after deploy

## External Core Cutover Sequence

The cutover sequence is now:

1. Deploy the persistent realtime core on a host like Render using the repo deployment assets.
2. Set `REALTIME_CORE_ALLOWED_ORIGIN=https://binance-trading-analysis-tool.vercel.app` on that service.
3. Run `npm run realtime-core:cutover -- --core-url=https://your-realtime-core-domain --app-url=https://binance-trading-analysis-tool.vercel.app`.
4. Run `npm run realtime-core:preflight -- --url=https://your-realtime-core-domain`.
5. Run `npm run realtime-core:smoke -- --app-url=https://binance-trading-analysis-tool.vercel.app --core-url=https://your-realtime-core-domain --username=... --password=...`.
6. Set `VITE_REALTIME_CORE_URL` in Vercel.
7. Redeploy the frontend.
8. Verify that CRYPE switches from `Fallback` to `Core` in the topbar and in `Perfil > Runtime realtime`.

### Pending

- remove serverless from the hot operational path
- introduce persistent realtime core service
- move shared planes from snapshot-heavy updates to event-driven overlays
- split hot operational data from cold/admin/reporting paths
