# Supabase Setup

Esta app ya puede leer usuarios desde una base de datos externa en Supabase.

## 1. Crear el proyecto

1. Crea un proyecto en Supabase.
2. Abre el SQL Editor.
3. Ejecuta el contenido de [supabase/users_schema.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/users_schema.sql).
4. Si vas a conectar Binance Testnet, ejecuta también [supabase/binance_testnet_connections.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/binance_testnet_connections.sql).
5. Si vas a usar watchlist persistente y memoria automática, ejecuta también [supabase/watchlist_items.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/watchlist_items.sql).
6. Si vas a usar el motor de estrategias y preparar experimentos/versionado, ejecuta también [supabase/strategy_engine.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/strategy_engine.sql).

## 2. Configurar Vercel

Agrega estas variables al proyecto en Vercel:

- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_USERS_TABLE`
- `SUPABASE_BINANCE_TABLE`
- `SUPABASE_WATCHLIST_TABLE`
- `SUPABASE_WATCHLIST_LISTS_TABLE`
- `SUPABASE_STRATEGY_REGISTRY_TABLE`
- `SUPABASE_STRATEGY_VERSIONS_TABLE`
- `SUPABASE_STRATEGY_EXPERIMENTS_TABLE`
- `SUPABASE_STRATEGY_RECOMMENDATIONS_TABLE`

Puedes usar [/.env.example](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/.env.example) como referencia.

## 3. Resultado esperado

Cuando `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` estén definidos:

- el login deja de usar usuarios sembrados
- `/api/auth/login` valida contra `public.app_users`
- `/api/users` lista usuarios desde Supabase
- `/api/binance/connection` guarda y lee la conexión cifrada de Binance Testnet
- `/api/watchlist` guarda y lee listas de seguimiento persistentes por usuario
- `/api/strategy-engine` expone el registro, versionado y experimentos del motor de estrategias
- `/api/strategy-engine/recommendations` genera y lee sugerencias adaptativas de parámetros

Mientras esas variables no existan, la app sigue usando el fallback local para no romper la preview.
