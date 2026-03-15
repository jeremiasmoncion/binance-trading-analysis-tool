# Supabase Setup

Esta app ya puede leer usuarios desde una base de datos externa en Supabase.

## 1. Crear el proyecto

1. Crea un proyecto en Supabase.
2. Abre el SQL Editor.
3. Ejecuta el contenido de [supabase/users_schema.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/users_schema.sql).
4. Si vas a conectar Binance Testnet, ejecuta también [supabase/binance_testnet_connections.sql](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/supabase/binance_testnet_connections.sql).

## 2. Configurar Vercel

Agrega estas variables al proyecto en Vercel:

- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_USERS_TABLE`
- `SUPABASE_BINANCE_TABLE`

Puedes usar [/.env.example](/Users/jeremiasmoncion/Documents/New%20project/binance-trading-analysis-tool/.env.example) como referencia.

## 3. Resultado esperado

Cuando `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` estén definidos:

- el login deja de usar usuarios sembrados
- `/api/auth/login` valida contra `public.app_users`
- `/api/users` lista usuarios desde Supabase
- `/api/binance/connection` guarda y lee la conexión cifrada de Binance Testnet

Mientras esas variables no existan, la app sigue usando el fallback local para no romper la preview.
