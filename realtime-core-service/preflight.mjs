import process from "node:process";

const requiredEnvKeys = [
  "SESSION_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REALTIME_CORE_ALLOWED_ORIGIN",
];

const optionalEnvKeys = [
  "REALTIME_CORE_PORT",
  "REALTIME_CORE_HOST",
  "REALTIME_CORE_BRIDGE_TTL_SECONDS",
  "REALTIME_CORE_POLL_INTERVAL_MS",
  "REALTIME_CORE_MAX_CHANNEL_IDLE_MS",
];

function readEnvSummary() {
  return {
    required: requiredEnvKeys.map((key) => ({
      key,
      configured: Boolean(String(process.env[key] || "").trim()),
    })),
    optional: optionalEnvKeys.map((key) => ({
      key,
      value: String(process.env[key] || "").trim() || "(default)",
    })),
  };
}

async function probeHealth(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/health`, {
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: {
        message: error instanceof Error ? error.message : "No se pudo consultar /health",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  const args = new Map(
    process.argv.slice(2).map((entry) => {
      const [key, value] = entry.split("=");
      return [key, value || ""];
    }),
  );

  const remoteUrl = String(args.get("--url") || "").trim();
  const envSummary = readEnvSummary();
  const missingRequired = envSummary.required.filter((item) => !item.configured);

  const report = {
    ok: missingRequired.length === 0,
    checkedAt: new Date().toISOString(),
    env: envSummary,
    health: null,
  };

  if (remoteUrl) {
    report.health = await probeHealth(remoteUrl);
    report.ok = report.ok && Boolean(report.health.ok);
  }

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

void main();
