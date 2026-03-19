import process from "node:process";

function parseArgs(argv) {
  return new Map(
    argv.map((entry) => {
      const [key, ...rest] = entry.split("=");
      return [key, rest.join("=")];
    }),
  );
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const first = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return String(first || "").split(";")[0] || "";
}

async function loginAndGetBridgeToken({ appUrl, username, password }) {
  const loginResponse = await fetch(`${appUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const loginPayload = await readJson(loginResponse);
  if (!loginResponse.ok) {
    throw new Error(loginPayload.message || "No se pudo iniciar sesión en la app");
  }

  const cookie = extractCookie(loginResponse.headers.get("set-cookie"));
  if (!cookie) {
    throw new Error("No se recibió cookie de sesión desde la app");
  }

  const sessionResponse = await fetch(`${appUrl}/api/realtime/session`, {
    headers: {
      Cookie: cookie,
    },
  });
  const sessionPayload = await readJson(sessionResponse);
  if (!sessionResponse.ok) {
    throw new Error(sessionPayload.message || "No se pudo obtener el bridge token");
  }

  return {
    cookie,
    token: String(sessionPayload.token || ""),
    expiresAt: String(sessionPayload.expiresAt || ""),
  };
}

async function probeHealth(coreUrl) {
  const response = await fetch(`${coreUrl}/health`);
  const payload = await readJson(response);
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function probeBootstrap(coreUrl, token) {
  const response = await fetch(`${coreUrl}/bootstrap?coin=BTC%2FUSDT&timeframe=1h&period=1d&token=${encodeURIComponent(token)}`);
  const payload = await readJson(response);
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function probeEvents(coreUrl, token) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(`${coreUrl}/events?token=${encodeURIComponent(token)}`, {
      headers: {
        Accept: "text/event-stream",
      },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      return {
        ok: false,
        status: response.status,
        preview: "",
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const { value } = await reader.read();
    const preview = decoder.decode(value || new Uint8Array());
    try {
      await reader.cancel();
    } catch {
      // ignore cancel errors
    }

    return {
      ok: preview.includes("event: system.") || preview.includes("retry:"),
      status: response.status,
      preview,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      preview: error instanceof Error ? error.message : "No se pudo leer el stream SSE",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const appUrl = normalizeUrl(args.get("--app-url"));
  const coreUrl = normalizeUrl(args.get("--core-url"));
  const username = String(args.get("--username") || "").trim();
  const password = String(args.get("--password") || "").trim();

  if (!appUrl || !coreUrl || !username || !password) {
    console.error("Uso: npm run realtime-core:smoke -- --app-url=https://app --core-url=https://core --username=user --password=pass");
    process.exit(1);
  }

  const bridge = await loginAndGetBridgeToken({ appUrl, username, password });
  const health = await probeHealth(coreUrl);
  const bootstrap = bridge.token ? await probeBootstrap(coreUrl, bridge.token) : { ok: false, status: 0, payload: {} };
  const events = bridge.token ? await probeEvents(coreUrl, bridge.token) : { ok: false, status: 0, preview: "" };

  const report = {
    ok: Boolean(bridge.token) && health.ok && bootstrap.ok && events.ok,
    checkedAt: new Date().toISOString(),
    bridge: {
      tokenIssued: Boolean(bridge.token),
      expiresAt: bridge.expiresAt,
    },
    health,
    bootstrap: {
      ok: bootstrap.ok,
      status: bootstrap.status,
      version: bootstrap.payload?.version || null,
      generatedAt: bootstrap.payload?.generatedAt || null,
    },
    events: {
      ok: events.ok,
      status: events.status,
      preview: String(events.preview || "").slice(0, 240),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

void main();
