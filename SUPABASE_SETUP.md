# Supabase Setup

Esta app ya puede leer usuarios desde una base de datos externa en Supabase.

## 1. Crear el proyecto

1. Crea un proyecto en Supabase.
2. Abre el SQL Editor.
3. Ejecuta el contenido de [supabase/users_schema.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/users_schema.sql).
4. Si vas a conectar Binance Testnet, ejecuta también [supabase/binance_testnet_connections.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/binance_testnet_connections.sql).
5. Si vas a usar watchlist persistente y memoria automática, ejecuta también [supabase/watchlist_items.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/watchlist_items.sql).
6. Si vas a usar el motor de estrategias y preparar experimentos/versionado, ejecuta también [supabase/strategy_engine.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/strategy_engine.sql).
7. Si quieres que el sistema vigile el watchlist automáticamente aunque la app no esté abierta, ejecuta también [supabase/watchlist_scanner.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/watchlist_scanner.sql).
8. Si quieres que `Señales` pueda preparar y enviar órdenes a Binance Demo, ejecuta también [supabase/execution_engine.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/execution_engine.sql).
9. Si quieres seguir el camino hacia una `IA full` con datos más limpios para scoring y trazabilidad, ejecuta también [supabase/ai_data_layer.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/ai_data_layer.sql).

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
- `SUPABASE_WATCHLIST_SCAN_STATE_TABLE`
- `SUPABASE_WATCHLIST_SCAN_RUNS_TABLE`
- `SUPABASE_EXECUTION_PROFILES_TABLE`
- `SUPABASE_EXECUTION_ORDERS_TABLE`
- `SUPABASE_EXECUTION_SCOPE_OVERRIDES_TABLE` (opcional, default `execution_scope_overrides`)
- `SUPABASE_ADAPTIVE_ACTIONS_LOG_TABLE` (opcional, default `adaptive_actions_log`)
- `SUPABASE_SIGNAL_FEATURE_SNAPSHOTS_TABLE` (opcional, default `signal_feature_snapshots`)
- `SUPABASE_AI_MODEL_CONFIGS_TABLE` (opcional, default `ai_model_configs`)
- `SUPABASE_BACKTEST_RUNS_TABLE` (opcional, default `backtest_runs`)
- `SUPABASE_BACKTEST_RUN_WINDOWS_TABLE` (opcional, default `backtest_run_windows`)
- `CRON_SECRET`
- `BINANCE_MARKET_DATA_URL` (opcional, recomendado `https://demo-api.binance.com` si el backend no puede consultar `api.binance.com`)

Puedes usar [/.env.example](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/.env.example) como referencia.

## 3. Resultado esperado

Cuando `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` estén definidos:

- el login deja de usar usuarios sembrados
- `/api/auth/login` valida contra `public.app_users`
- `/api/users` lista usuarios desde Supabase
- `/api/binance/connection` guarda y lee la conexión cifrada de Binance Testnet
- `/api/watchlist` guarda y lee listas de seguimiento persistentes por usuario
- `/api/watchlist/scan` puede vigilar el watchlist en backend, generar señales automáticas y cerrar pendientes sin depender de la UI
- `/api/strategy-engine` expone el registro, versionado y experimentos del motor de estrategias
- `/api/strategy-engine/recommendations` genera y lee sugerencias adaptativas de parámetros
- `/api/binance/execution` prepara trades candidatos, guarda intentos y puede enviar órdenes reales a Binance Demo con guardrails básicos
- `execution_scope_overrides`, `adaptive_actions_log`, `signal_feature_snapshots`, `ai_model_configs`, `backtest_runs` y `backtest_run_windows` dejan la base lista para evolucionar desde heurística adaptativa hacia un scorer/modelo real con validación técnica persistida

Mientras esas variables no existan, la app sigue usando el fallback local para no romper la preview.
