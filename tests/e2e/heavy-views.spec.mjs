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

async function ensureSubmenuLinkVisible(page, parentLabel, childTestId) {
  const link = page.getByTestId(childTestId);
  if (await link.isVisible().catch(() => false)) {
    return link;
  }

  await page.getByRole("button", { name: parentLabel, exact: true }).click();
  await expect(link).toBeVisible({ timeout: 15_000 });
  return link;
}

async function openSidebarView(page, childTestId, options) {
  const { parentLabel, readyAssertion } = options;
  const link = parentLabel
    ? await ensureSubmenuLinkVisible(page, parentLabel, childTestId)
    : page.getByTestId(childTestId);

  await link.click();
  await waitForWorkspaceReady(page);
  await readyAssertion();
}

test.describe("heavy view ux and performance smoke", () => {
  test("opens the heaviest authenticated views without stalling or rendering empty shells", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Total portfolio", { exact: true })).toBeVisible({ timeout: 20_000 });

    await openSidebarView(page, "sidebar-nav-control-bot-settings", {
      parentLabel: "Control Panel",
      readyAssertion: async () => {
        await expect(page.getByRole("heading", { name: "Bot Settings", exact: true })).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('[data-testid^="bot-card-name-"]').first()).toBeVisible({ timeout: 20_000 });
      },
    });

    await openSidebarView(page, "sidebar-nav-ai-signal-bot", {
      parentLabel: "AI Bot",
      readyAssertion: async () => {
        await expect(page.locator(".signalbot-title")).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("button", { name: "Active Signals", exact: true })).toBeVisible({ timeout: 20_000 });
      },
    });

    await openSidebarView(page, "sidebar-nav-control-execution-logs", {
      parentLabel: "Control Panel",
      readyAssertion: async () => {
        await expect(page.getByRole("heading", { name: "Execution Logs", exact: true })).toBeVisible({ timeout: 20_000 });
        await expect(page.getByText("Total Executions", { exact: true })).toBeVisible({ timeout: 20_000 });
      },
    });

    await page.getByTestId("topbar-user-menu-toggle").click();
    await page.getByTestId("topbar-user-open-profile").click();
    await waitForWorkspaceReady(page);
    await expect(page.getByText("Profile Settings", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Signal Memory", { exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Backtesting", exact: true }).click();
    await waitForWorkspaceReady(page);
    await expect(page.getByText("Laboratorio de backtesting", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Actualizar backtesting|Actualizando/i })).toBeVisible({ timeout: 20_000 });
  });
});
