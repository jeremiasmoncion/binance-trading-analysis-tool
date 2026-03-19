#!/usr/bin/env node

const DEFAULT_APP_URL = 'https://binance-trading-analysis-tool.vercel.app';

function parseArgs(argv) {
  const args = {};
  for (const part of argv) {
    if (!part.startsWith('--')) continue;
    const [rawKey, ...rest] = part.slice(2).split('=');
    args[rawKey] = rest.length > 0 ? rest.join('=') : 'true';
  }
  return args;
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function formatStatus(ok, label, detail = '') {
  const prefix = ok ? '[OK]' : '[PENDING]';
  return `${prefix} ${label}${detail ? `: ${detail}` : ''}`;
}

async function fetchHealth(url) {
  try {
    const response = await fetch(new URL('/health', url), {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        ok: false,
        detail: `HTTP ${response.status}`,
      };
    }

    const payload = await response.json();
    return {
      ok: true,
      detail: `mode=${payload.serviceMode ?? 'unknown'} channels=${payload.activeChannels ?? 0} subscribers=${payload.activeSubscribers ?? 0}`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const coreUrl = args['core-url'] ?? '';
  const appUrl = args['app-url'] ?? DEFAULT_APP_URL;
  const frontendRealtimeUrl = process.env.VITE_REALTIME_CORE_URL ?? '';
  const allowedOrigin = process.env.REALTIME_CORE_ALLOWED_ORIGIN ?? '';

  const requiredServiceEnvs = [
    'SESSION_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'REALTIME_CORE_ALLOWED_ORIGIN',
  ];

  const localEnvStatus = requiredServiceEnvs.map((name) => ({
    name,
    present: Boolean(process.env[name]),
  }));

  printSection('CRYPE realtime cutover readiness');
  console.log(`App URL: ${appUrl}`);
  console.log(`Core URL: ${coreUrl || '(not provided)'}`);
  console.log(`Frontend env VITE_REALTIME_CORE_URL: ${frontendRealtimeUrl || '(empty)'}`);
  console.log(`Realtime allowed origin: ${allowedOrigin || '(empty)'}`);

  printSection('1. Service envs');
  for (const entry of localEnvStatus) {
    console.log(formatStatus(entry.present, entry.name, entry.present ? 'configured locally' : 'missing locally'));
  }

  printSection('2. Host alignment');
  const originMatches = Boolean(coreUrl) && Boolean(allowedOrigin) ? allowedOrigin === appUrl : false;
  console.log(formatStatus(Boolean(coreUrl), 'Core URL provided', coreUrl || 'run with --core-url=https://your-core-domain'));
  console.log(formatStatus(Boolean(frontendRealtimeUrl), 'Frontend realtime URL configured', frontendRealtimeUrl || 'pending Vercel env'));
  console.log(formatStatus(originMatches, 'Allowed origin matches app URL', originMatches ? allowedOrigin : `expected ${appUrl}`));

  printSection('3. Remote health');
  if (!coreUrl) {
    console.log(formatStatus(false, 'Remote health check', 'skipped because --core-url was not provided'));
  } else {
    const health = await fetchHealth(coreUrl);
    console.log(formatStatus(health.ok, 'GET /health', health.detail));
  }

  printSection('4. Next commands');
  console.log(`- npm run realtime-core:preflight -- --url=${coreUrl || 'https://your-realtime-core-domain'}`);
  console.log(`- npm run realtime-core:smoke -- --app-url=${appUrl} --core-url=${coreUrl || 'https://your-realtime-core-domain'} --username=jeremias --password=1212`);
  console.log('- If both pass, set VITE_REALTIME_CORE_URL in Vercel and redeploy the frontend');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
