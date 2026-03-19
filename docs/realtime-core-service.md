# Realtime Core Service

## Purpose

This service is the migration target for CRYPE's hot live path.

It exists to move:

- live dashboard overlays
- live execution state
- live portfolio summary
- future event streams

out of Vercel serverless and into a persistent process with hot memory.

## Current Endpoints

- `GET /health`
- `GET /bootstrap`
- `GET /events`

## Current Status

This is a transitional service scaffold.

Today it:

- reuses existing shared backend logic from `api/_lib`
- serves the same bootstrap contract as the serverless fallback
- serves the same system overlay stream as the serverless fallback
- allows the frontend to switch to an external realtime core by setting `VITE_REALTIME_CORE_URL`
- supports a bridge-token auth flow via `GET /api/realtime/session` so the external service does not depend on same-origin cookies
- keeps per-user overlay channels hot in memory, so multiple tabs share one polling loop and one cached overlay state

It does **not** yet:

- aggregate exchange streams once and fan out diffs
- replace the watcher/scanner runtime
- fully remove serverless from the hot path

## Local Run

Use:

```bash
npm run realtime-core
```

Preflight before cutover:

```bash
npm run realtime-core:preflight
npm run realtime-core:preflight -- --url=https://your-realtime-core-domain
npm run realtime-core:cutover -- --core-url=https://your-realtime-core-domain --app-url=https://binance-trading-analysis-tool.vercel.app
```

Smoke test after deploy:

```bash
npm run realtime-core:smoke -- \
  --app-url=https://binance-trading-analysis-tool.vercel.app \
  --core-url=https://your-realtime-core-domain \
  --username=jeremias \
  --password=1212
```

Container build:

```bash
docker build -t crype-realtime-core .
docker run --rm -p 8787:8787 \
  -e SESSION_SECRET=replace-me \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=replace-me \
  -e REALTIME_CORE_ALLOWED_ORIGIN=http://localhost:5173 \
  crype-realtime-core
```

Default envs:

- `REALTIME_CORE_PORT=8787`
- `REALTIME_CORE_HOST=0.0.0.0`
- `REALTIME_CORE_ALLOWED_ORIGIN=http://localhost:5173`
- `REALTIME_CORE_BRIDGE_TTL_SECONDS=1800`
- `REALTIME_CORE_POLL_INTERVAL_MS=8000`
- `REALTIME_CORE_MAX_CHANNEL_IDLE_MS=90000`

To make the frontend consume it:

- set `VITE_REALTIME_CORE_URL=http://localhost:8787`

## Auth Bridge

When `VITE_REALTIME_CORE_URL` is defined, the frontend first requests:

- `GET /api/realtime/session`

That route issues a short-lived bridge token derived from the current CRYPE session. The frontend appends that token to:

- `GET {VITE_REALTIME_CORE_URL}/bootstrap`
- `GET {VITE_REALTIME_CORE_URL}/events`

This keeps Vercel session cookies on the app domain while still allowing the external realtime core to authenticate requests cross-origin.

## Frontend Safety Model

The frontend now uses this external service in a guarded way:

- it probes `GET /health` first
- it only prefers the external realtime core when that probe succeeds
- if `bootstrap` fails after a healthy probe, it falls back to the internal Vercel route
- if the external SSE stream breaks, it falls back to the internal Vercel SSE route

This lets us enable `VITE_REALTIME_CORE_URL` in production without turning the external service into a single point of failure on day one.

## Current Runtime Model

The service now keeps a hot in-memory channel per authenticated user.

Each channel:

- caches the latest `system overlay`
- reuses one polling loop for all subscribers of that user
- emits `system.overlay.updated` only when the overlay actually changes
- still emits `system.heartbeat` on each cycle
- self-cleans after an idle window with no subscribers

This is the first real step from `request composition` toward `persistent orchestration`.

## Stability Guards Now In Place

The runtime now protects the UI from degraded live frames.

Current protections:

- `dashboard summary` keeps the last good state when a new live frame is partial or degraded
- `execution overlay` keeps the last good state when a new live frame is weaker than the current one
- frontend applies the same principle again before letting a degraded overlay replace a good one
- bootstrap no longer replaces a full portfolio snapshot with a lighter live overlay payload

This makes the external realtime core safer during Binance/API instability and reduces visible KPI jumps on the dashboard.

## Recommended Next Infra Step

Run this service on a persistent host:

- Fly.io
- Railway
- Render
- ECS/Fargate
- a small VM/container host

Then point the frontend to it with:

- `VITE_REALTIME_CORE_URL=https://your-realtime-core-domain`

## Deployment Assets In Repo

The repo now includes:

- [Dockerfile](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/Dockerfile)
- [.dockerignore](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/.dockerignore)
- [render.yaml](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/render.yaml)

That means the service is ready to be deployed as a persistent container without inventing new runtime wiring.

## Cutover Preflight

Before setting `VITE_REALTIME_CORE_URL` in Vercel, run:

1. `npm run realtime-core:preflight`
2. `npm run realtime-core:preflight -- --url=https://your-realtime-core-domain`

This validates:

- required envs for the persistent service
- optional runtime knobs
- remote `/health` response when a URL is provided

If the command exits with non-zero status, fix that first and do not cut production over yet.

## Post-Deploy Smoke Test

After the persistent service is up, run:

1. `npm run realtime-core:smoke -- --app-url=https://binance-trading-analysis-tool.vercel.app --core-url=https://your-realtime-core-domain --username=... --password=...`

This validates end-to-end:

- login against the app domain
- bridge token issuance from `/api/realtime/session`
- remote `/health`
- authenticated `/bootstrap`
- first SSE frame from `/events`

Only after this should you set `VITE_REALTIME_CORE_URL` in Vercel and redeploy the frontend.

## Render + Vercel Cutover Runbook

Use this exact sequence:

1. Deploy the service from the repo `render.yaml` as `crype-realtime-core`.
2. Set these Render envs:
   - `SESSION_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `REALTIME_CORE_ALLOWED_ORIGIN=https://binance-trading-analysis-tool.vercel.app`
3. Wait until Render shows the service healthy on `/health`.
4. Run:
   - `npm run realtime-core:cutover -- --core-url=https://your-realtime-core-domain --app-url=https://binance-trading-analysis-tool.vercel.app`
   - `npm run realtime-core:preflight -- --url=https://your-realtime-core-domain`
   - `npm run realtime-core:smoke -- --app-url=https://binance-trading-analysis-tool.vercel.app --core-url=https://your-realtime-core-domain --username=jeremias --password=1212`
5. In Vercel, set:
   - `VITE_REALTIME_CORE_URL=https://your-realtime-core-domain`
6. Redeploy the frontend.
7. Verify inside CRYPE:
   - topbar badge switches from `Fallback` to `Core`
   - `Perfil > Runtime realtime` shows active external mode
   - manual `Revalidar runtime` succeeds

The new `realtime-core:cutover` command gives a quick readiness report before you run the stricter `preflight` and `smoke` commands.

## Migration Path

1. Externalize `bootstrap` and `events` to this service.
2. Move `portfolio live`, `execution`, `dashboard summary`, and `signal memory` into hot in-memory state.
3. Replace polling composition with exchange/user streams plus periodic reconciliation.
4. Leave Vercel only for cold/admin/reporting routes.
