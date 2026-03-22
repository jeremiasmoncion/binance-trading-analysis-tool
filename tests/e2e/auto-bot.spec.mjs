import { test, expect } from "@playwright/test";

const USER = {
  username: process.env.E2E_USER_ONE_USERNAME || "jeremias",
  password: process.env.E2E_USER_ONE_PASSWORD || "1212",
};

async function waitForLoginOverlay(page) {
  await expect(page.getByTestId("login-overlay")).toBeVisible({ timeout: 20_000 });
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

async function waitForAuthenticatedShell(page, username = USER.username) {
  await expect(page.locator(".sidebar-user-name")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".sidebar-user-email")).toContainText(`${username}@crype.app`, { timeout: 20_000 });
}

async function logoutFromShell(page) {
  await page.getByTestId("topbar-user-menu-toggle").click();
  await page.getByTestId("topbar-user-logout").click();
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

    await logoutFromShell(page);
  }

  await waitForLoginOverlay(page);
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await waitForAuthenticatedShell(page, user.username);
  await waitForWorkspaceReady(page);
}

async function openSignalBot(page) {
  await page.getByTestId("sidebar-nav-ai-signal-bot").click();
  await waitForWorkspaceReady(page);
  await expect(page.getByTestId("signalbot-title")).toBeVisible({ timeout: 20_000 });
}

async function openSignalBotSettingsTab(page) {
  await page.locator("#signalBotView").getByRole("button", { name: "Bot Settings", exact: true }).click();
  await waitForWorkspaceReady(page);
  await expect(page.getByTestId("signalbot-auto-execute-toggle")).toBeVisible({ timeout: 20_000 });
}

function parseSignalBotSubtitle(text) {
  const [pair = "", strategy = "", status = ""] = String(text || "")
    .split("•")
    .map((part) => part.trim());
  return { pair, strategy, status };
}

async function readSignalBotWorkspace(page) {
  const title = ((await page.getByTestId("signalbot-title").textContent()) || "").trim();
  const subtitle = ((await page.locator(".signalbot-subtitle").textContent()) || "").trim();
  return {
    title,
    ...parseSignalBotSubtitle(subtitle),
  };
}

async function waitForHydratedSignalBotWorkspace(page) {
  await expect.poll(async () => {
    const workspace = await readSignalBotWorkspace(page);
    return Boolean(workspace.pair) && workspace.status.toLowerCase() !== "draft";
  }, { timeout: 20_000 }).toBe(true);

  return readSignalBotWorkspace(page);
}

async function fetchBots(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/bots", { credentials: "include" });
    if (!response.ok) {
      throw new Error(`bots request failed with ${response.status}`);
    }
    const payload = await response.json();
    return Array.isArray(payload.bots) ? payload.bots : [];
  });
}

test.describe("automatic bot mode", () => {
  test("persists auto-execute state and keeps bot policy synchronized", async ({ page }) => {
    await login(page);
    await openSignalBot(page);
    await openSignalBotSettingsTab(page);
    const workspace = await waitForHydratedSignalBotWorkspace(page);

    const toggle = page.getByTestId("signalbot-auto-execute-toggle");
    const initialChecked = (await toggle.getAttribute("aria-checked")) === "true";
    const nextChecked = !initialChecked;

    const initialBots = await fetchBots(page);
    const selectedBotBefore = initialBots.find((bot) => (
      String(bot.workspaceSettings?.primaryPair || "").trim().toUpperCase() === workspace.pair.toUpperCase()
      && String(bot.status || "").trim().toLowerCase() !== "disabled"
    ));
    expect(selectedBotBefore).toBeTruthy();
    expect(String(selectedBotBefore.status || "").trim().toLowerCase()).not.toBe("disabled");

    try {
      await toggle.click();

      await expect(page.getByText(nextChecked ? "Auto-Execute activado" : "Auto-Execute desactivado", { exact: true }))
        .toBeVisible({ timeout: 20_000 });
      await expect(toggle).toHaveAttribute("aria-checked", String(nextChecked));

      await expect.poll(async () => {
        const bots = await fetchBots(page);
        const selectedBot = bots.find((bot) => String(bot.id || "").trim() === String(selectedBotBefore.id || "").trim());
        return JSON.stringify({
          automationMode: String(selectedBot?.automationMode || ""),
          autoExecutionEnabled: Boolean(selectedBot?.executionPolicy?.autoExecutionEnabled),
          suggestionsOnly: Boolean(selectedBot?.executionPolicy?.suggestionsOnly),
          requiresHumanApproval: Boolean(selectedBot?.executionPolicy?.requiresHumanApproval),
          canOpenPositions: Boolean(selectedBot?.executionPolicy?.canOpenPositions),
        });
      }, { timeout: 20_000 }).toBe(JSON.stringify({
        automationMode: nextChecked ? "auto" : "observe",
        autoExecutionEnabled: nextChecked,
        suggestionsOnly: !nextChecked,
        requiresHumanApproval: !nextChecked,
        canOpenPositions: nextChecked,
      }));

      await page.reload();
      await waitForWorkspaceReady(page);
      await openSignalBot(page);
      await openSignalBotSettingsTab(page);
      await waitForHydratedSignalBotWorkspace(page);
      await expect(page.getByTestId("signalbot-auto-execute-toggle")).toHaveAttribute("aria-checked", String(nextChecked));
    } finally {
      await page.reload();
      await waitForWorkspaceReady(page);
      await openSignalBot(page);
      await openSignalBotSettingsTab(page);
      await waitForHydratedSignalBotWorkspace(page);
      const currentToggle = page.getByTestId("signalbot-auto-execute-toggle");
      const currentChecked = (await currentToggle.getAttribute("aria-checked")) === "true";
      if (currentChecked !== initialChecked) {
        await currentToggle.click();
        await expect(page.getByText(initialChecked ? "Auto-Execute activado" : "Auto-Execute desactivado", { exact: true }))
          .toBeVisible({ timeout: 20_000 });
        await expect(currentToggle).toHaveAttribute("aria-checked", String(initialChecked));
      }
    }
  });
});
