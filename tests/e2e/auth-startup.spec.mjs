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

async function login(page, user = USER) {
  await page.goto("/");
  await page.waitForSelector('[data-testid="login-overlay"], [data-testid="startup-overlay"], .sidebar-user-email', {
    timeout: 20_000,
  });

  const sidebarEmail = page.locator(".sidebar-user-email");
  if (await sidebarEmail.isVisible().catch(() => false)) {
    const currentEmail = (await sidebarEmail.textContent()) || "";
    if (currentEmail.toLowerCase().includes(`${user.username}@crype.app`)) {
      return;
    }

    await page.locator(".sidebar-user-link-danger").click();
  }

  await waitForLoginOverlay(page);
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await waitForAuthenticatedShell(page, user.username);
}

test.describe("auth startup stability", () => {
  test("restores an authenticated session after reload without stalling on startup overlays", async ({ page }) => {
    await login(page);

    await page.reload();
    await page.waitForSelector('[data-testid="login-overlay"], [data-testid="startup-overlay"], .sidebar-user-email', {
      timeout: 20_000,
    });

    const startupOverlay = page.getByTestId("startup-overlay");
    if (await startupOverlay.isVisible().catch(() => false)) {
      await expect(startupOverlay).toBeHidden({ timeout: 20_000 });
    }

    await waitForAuthenticatedShell(page);
    await expect(page.getByTestId("login-overlay")).toBeHidden();
  });

  test("shows a recoverable login error instead of staying on startup gating when the session is not confirmed", async ({ page }) => {
    await page.goto("/");
    await waitForLoginOverlay(page);

    await page.getByTestId("login-username").fill("jeremias");
    await page.getByTestId("login-password").fill("wrong-password");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("login-error")).toContainText(/\S+/, { timeout: 20_000 });
    await expect(page.getByTestId("login-overlay")).toBeVisible();
    await expect(page.getByTestId("startup-overlay")).toBeHidden();
  });
});
