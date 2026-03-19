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

It does **not** yet:

- keep state hot in memory across domains
- aggregate exchange streams once and fan out diffs
- replace the watcher/scanner runtime
- fully remove serverless from the hot path

## Local Run

Use:

```bash
npm run realtime-core
```

Default envs:

- `REALTIME_CORE_PORT=8787`
- `REALTIME_CORE_HOST=0.0.0.0`
- `REALTIME_CORE_ALLOWED_ORIGIN=http://localhost:5173`

To make the frontend consume it:

- set `VITE_REALTIME_CORE_URL=http://localhost:8787`

## Recommended Next Infra Step

Run this service on a persistent host:

- Fly.io
- Railway
- Render
- ECS/Fargate
- a small VM/container host

Then point the frontend to it with:

- `VITE_REALTIME_CORE_URL=https://your-realtime-core-domain`

## Migration Path

1. Externalize `bootstrap` and `events` to this service.
2. Move `portfolio live`, `execution`, `dashboard summary`, and `signal memory` into hot in-memory state.
3. Replace polling composition with exchange/user streams plus periodic reconciliation.
4. Leave Vercel only for cold/admin/reporting routes.
