import { test, expect } from "@playwright/test";

const USER = {
  username: process.env.E2E_USER_ONE_USERNAME || "jeremias",
  password: process.env.E2E_USER_ONE_PASSWORD || "1212",
};

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

test.describe("bot settings live refresh", () => {
  test("requests execution center immediately when entering Bot Settings", async ({ page }) => {
    await login(page);

    await page.getByTestId("sidebar-nav-dashboard").click();
    await waitForWorkspaceReady(page);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 20_000 });

    const executionResponsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return request.method() === "GET"
        && response.url().includes("/api/binance/execution")
        && response.status() >= 200
        && response.status() < 300;
    }, { timeout: 12_000 });

    await page.getByTestId("sidebar-nav-control-bot-settings").click();

    const executionResponse = await executionResponsePromise;
    expect(executionResponse.ok()).toBeTruthy();

    await waitForWorkspaceReady(page);
    await expect(page.getByRole("heading", { name: "Bot Settings", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid^="bot-card-name-"]').first()).toBeVisible({ timeout: 20_000 });
  });
});
