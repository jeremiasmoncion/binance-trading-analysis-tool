import { test, expect } from "@playwright/test";

const USER = {
  username: process.env.E2E_USER_ONE_USERNAME || "jeremias",
  password: process.env.E2E_USER_ONE_PASSWORD || "1212",
};

const SAMPLE_INTERVAL_MS = 5_000;
const QUICK_VIEW_DURATION_MS = 15_000;
const BOT_VIEW_DURATION_MS = 35_000;

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function summarizeDelta(initial, final) {
  return {
    changed: JSON.stringify(initial) !== JSON.stringify(final),
    initial,
    final,
  };
}

async function waitForLoginOverlay(page) {
  await expect(page.getByTestId("login-overlay")).toBeVisible({ timeout: 20_000 });
}

async function waitForAuthenticatedShell(page, username = USER.username) {
  await expect(page.locator(".sidebar-user-name")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".sidebar-user-email")).toContainText(`${username}@crype.app`, { timeout: 20_000 });
}

async function waitForWorkspaceReady(page) {
  const startupOverlay = page.getByTestId("startup-overlay");
  if (await startupOverlay.isVisible().catch(() => false)) {
    await expect(startupOverlay).toBeHidden({ timeout: 30_000 });
  }

  const loadingCopy = page.getByText("Cargando vista...");
  if (await loadingCopy.isVisible().catch(() => false)) {
    await expect(loadingCopy).toBeHidden({ timeout: 45_000 });
  }
}

async function login(page, user = USER) {
  await page.goto("/");
  await page.waitForSelector('[data-testid="login-overlay"], [data-testid="startup-overlay"], .sidebar-user-email', {
    timeout: 20_000,
  });

  const sidebarEmail = page.locator(".sidebar-user-email");
  if (await sidebarEmail.isVisible().catch(() => false)) {
    const currentEmail = (await sidebarEmail.textContent()) || "";
    if (currentEmail.toLowerCase().includes(`${user.username}@crype.app`)) {
      await waitForWorkspaceReady(page);
      return;
    }

    await page.getByTestId("topbar-user-menu-toggle").click();
    await page.getByTestId("topbar-user-logout").click();
  }

  await waitForLoginOverlay(page);
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await waitForAuthenticatedShell(page, user.username);
  await waitForWorkspaceReady(page);
}

async function openView(page, viewTestId, ready) {
  await page.getByTestId(viewTestId).click();
  await waitForWorkspaceReady(page);
  await ready();
}

async function snapshotDashboard(page) {
  const overview = page.locator(".dashboard-overview-grid");
  await expect(overview).toBeVisible({ timeout: 20_000 });

  return {
    overview: normalizeText(await overview.textContent()),
  };
}

async function snapshotWallet(page) {
  const hero = page.locator(".wallet-hero-card");
  await expect(hero).toBeVisible({ timeout: 20_000 });

  return {
    hero: normalizeText(await hero.textContent()),
  };
}

async function snapshotBotSettings(page) {
  const summary = page.locator(".botsettings-summary-grid");
  const firstCard = page.locator('[data-testid^="bot-card-"][data-bot-status]').first();
  await expect(summary).toBeVisible({ timeout: 20_000 });
  await expect(firstCard).toBeVisible({ timeout: 20_000 });

  return {
    summary: normalizeText(await summary.textContent()),
    firstCard: normalizeText(await firstCard.textContent()),
  };
}

async function snapshotSignalBot(page) {
  const summary = page.locator(".signalbot-summary-grid");
  const title = page.getByTestId("signalbot-title");
  await expect(title).toBeVisible({ timeout: 20_000 });
  await expect(summary).toBeVisible({ timeout: 20_000 });

  return {
    title: normalizeText(await title.textContent()),
    summary: normalizeText(await summary.textContent()),
  };
}

async function observeView(page, options) {
  const { name, durationMs, snapshot } = options;
  const samples = [];
  const start = Date.now();

  const initial = await snapshot(page);
  samples.push({ atMs: 0, snapshot: initial });

  let firstChangeAtMs = null;
  while (Date.now() - start < durationMs) {
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
    const current = await snapshot(page);
    const atMs = Date.now() - start;
    samples.push({ atMs, snapshot: current });

    if (firstChangeAtMs == null && JSON.stringify(current) !== JSON.stringify(initial)) {
      firstChangeAtMs = atMs;
    }
  }

  const final = samples.at(-1)?.snapshot || initial;
  return {
    name,
    durationMs,
    firstChangeAtMs,
    ...summarizeDelta(initial, final),
    samples,
  };
}

test.describe("live hydration diagnostic", () => {
  test.setTimeout(240_000);

  test("observes visible drift during a 1+ minute authenticated browsing session", async ({ page, browserName }, testInfo) => {
    const networkEvents = [];
    const sessionStart = Date.now();

    page.on("response", (response) => {
      const url = response.url();
      if (!url.includes("/api/binance/")) {
        return;
      }

      if (
        !url.includes("/api/binance/dashboard-summary")
        && !url.includes("/api/binance/portfolio")
        && !url.includes("/api/binance/execution")
      ) {
        return;
      }

      networkEvents.push({
        atMs: Date.now() - sessionStart,
        status: response.status(),
        url: url.replace(/^https?:\/\/[^/]+/, ""),
      });
    });

    await login(page);

    const reports = [];

    await openView(page, "sidebar-nav-dashboard", async () => {
      await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 20_000 });
    });
    reports.push(await observeView(page, {
      name: "dashboard",
      durationMs: QUICK_VIEW_DURATION_MS,
      snapshot: snapshotDashboard,
    }));

    await openView(page, "sidebar-nav-balance", async () => {
      await expect(page.getByText("Total Portfolio Value", { exact: true })).toBeVisible({ timeout: 20_000 });
    });
    reports.push(await observeView(page, {
      name: "my-wallet",
      durationMs: QUICK_VIEW_DURATION_MS,
      snapshot: snapshotWallet,
    }));

    await openView(page, "sidebar-nav-control-bot-settings", async () => {
      await expect(page.getByRole("heading", { name: "Bot Settings", exact: true })).toBeVisible({ timeout: 20_000 });
    });
    reports.push(await observeView(page, {
      name: "bot-settings",
      durationMs: BOT_VIEW_DURATION_MS,
      snapshot: snapshotBotSettings,
    }));

    await openView(page, "sidebar-nav-ai-signal-bot", async () => {
      await expect(page.getByTestId("signalbot-title")).toBeVisible({ timeout: 20_000 });
    });
    reports.push(await observeView(page, {
      name: "signal-bot",
      durationMs: BOT_VIEW_DURATION_MS,
      snapshot: snapshotSignalBot,
    }));

    const diagnostic = {
      browser: browserName,
      baseURL: testInfo.project.use.baseURL,
      totalSessionMs: Date.now() - sessionStart,
      reports: reports.map((report) => ({
        name: report.name,
        changed: report.changed,
        firstChangeAtMs: report.firstChangeAtMs,
        initial: report.initial,
        final: report.final,
      })),
      networkEvents,
    };

    console.log(`LIVE-HYDRATION-DIAGNOSTIC ${JSON.stringify(diagnostic)}`);
    await testInfo.attach(`live-hydration-${browserName}.json`, {
      body: JSON.stringify(diagnostic, null, 2),
      contentType: "application/json",
    });
  });
});
