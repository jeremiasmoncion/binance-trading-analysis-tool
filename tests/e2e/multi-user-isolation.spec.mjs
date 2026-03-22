import { test, expect } from "@playwright/test";

const E2E_USERS = [
  {
    key: "jeremias",
    username: process.env.E2E_USER_ONE_USERNAME || "jeremias",
    password: process.env.E2E_USER_ONE_PASSWORD || "1212",
  },
  {
    key: "yeudy",
    username: process.env.E2E_USER_TWO_USERNAME || "yeudy",
    password: process.env.E2E_USER_TWO_PASSWORD || "1212",
  },
];

function normalizeBotState(bot) {
  return String(bot?.status || "").trim().toLowerCase();
}

function asSortedNames(cards) {
  return [...cards].map((card) => card.name).sort((left, right) => left.localeCompare(right));
}

async function waitForWorkspaceReady(page) {
  const loadingCopy = page.getByText("Cargando vista...");
  if (await loadingCopy.isVisible().catch(() => false)) {
    await expect(loadingCopy).toBeHidden({ timeout: 45_000 });
  }
}

async function logout(page) {
  const sidebarLogout = page.getByTestId("sidebar-logout");
  if (await sidebarLogout.isVisible().catch(() => false)) {
    await sidebarLogout.click();
  } else {
    await page.getByTestId("topbar-user-menu-toggle").click();
    await page.getByTestId("topbar-user-logout").click();
  }

  await expect(page.getByTestId("login-overlay")).toBeVisible();
}

async function login(page, user) {
  await page.goto("/");
  await page.waitForSelector('[data-testid="login-overlay"], .sidebar-user-email', {
    timeout: 20_000,
  });

  const sidebarEmail = page.locator(".sidebar-user-email");
  if (await sidebarEmail.isVisible().catch(() => false)) {
    const currentEmail = (await sidebarEmail.textContent()) || "";
    if (currentEmail.toLowerCase().includes(`${user.username}@crype.app`)) {
      return;
    }

    await logout(page);
  }

  await expect(page.getByTestId("login-overlay")).toBeVisible();
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await expect(page.locator(".sidebar-user-name")).toBeVisible();
  await expect(page.locator(".sidebar-user-email")).toContainText(`${user.username}@crype.app`);
  await waitForWorkspaceReady(page);
}

async function openBotSettings(page) {
  const botSettingsLink = page.getByTestId("sidebar-nav-control-bot-settings");
  if (!(await botSettingsLink.isVisible({ timeout: 2_000 }).catch(() => false))) {
    const controlPanelToggle = page.getByRole("button", { name: "Control Panel", exact: true });
    if (await controlPanelToggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await controlPanelToggle.click();
    }
    await expect(botSettingsLink).toBeVisible({ timeout: 15_000 });
  }
  await botSettingsLink.click();
  await expect(page.getByText("Bot Settings", { exact: true })).toBeVisible();
  await waitForWorkspaceReady(page);
}

async function fetchSessionSnapshot(page) {
  return page.evaluate(async () => {
    const [sessionResponse, botsResponse] = await Promise.all([
      fetch("/api/auth/session", { credentials: "include" }),
      fetch("/api/bots", { credentials: "include" }),
    ]);

    if (!sessionResponse.ok) {
      throw new Error(`session request failed with ${sessionResponse.status}`);
    }

    if (!botsResponse.ok) {
      throw new Error(`bots request failed with ${botsResponse.status}`);
    }

    const sessionPayload = await sessionResponse.json();
    const botsPayload = await botsResponse.json();

    return {
      user: sessionPayload.user,
      bots: Array.isArray(botsPayload.bots) ? botsPayload.bots : [],
    };
  });
}

async function readVisibleBotCards(page) {
  const cards = page.locator('[data-testid^="bot-card-"][data-bot-status]');
  const count = await cards.count();
  const result = [];

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const name = (await card.locator('[data-testid^="bot-card-name-"]').innerText()).trim();
    const pair = (await card.locator('[data-testid^="bot-card-pair-"]').innerText()).trim();
    const status = (await card.locator('[data-testid^="bot-card-status-"]').innerText()).trim();
    result.push({ name, pair, status });
  }

  return result;
}

async function applyStatusFilter(page, filter) {
  await page.getByTestId(`bot-status-filter-${filter}`).click();
}

async function expectBotGridToMatchApi(page, expectedBots) {
  await waitForWorkspaceReady(page);
  if (expectedBots.length) {
    await page.locator('[data-testid^="bot-card-name-"]').first().waitFor({ state: "visible", timeout: 30_000 });
  }
  const visibleCards = await readVisibleBotCards(page);
  expect(asSortedNames(visibleCards)).toEqual(
    [...expectedBots].map((bot) => String(bot.name || "").trim()).sort((left, right) => left.localeCompare(right)),
  );
}

test.describe("multi-user bot isolation", () => {
  test("keeps jeremias and yeudy isolated in parallel browser contexts", async ({ browser }) => {
    const jeremiasContext = await browser.newContext();
    const yeudyContext = await browser.newContext();
    const jeremiasPage = await jeremiasContext.newPage();
    const yeudyPage = await yeudyContext.newPage();

    try {
      await Promise.all([
        login(jeremiasPage, E2E_USERS[0]),
        login(yeudyPage, E2E_USERS[1]),
      ]);

      const [jeremiasSnapshot, yeudySnapshot] = await Promise.all([
        fetchSessionSnapshot(jeremiasPage),
        fetchSessionSnapshot(yeudyPage),
      ]);

      expect(String(jeremiasSnapshot.user?.username || "").toLowerCase()).toBe(E2E_USERS[0].username);
      expect(String(yeudySnapshot.user?.username || "").toLowerCase()).toBe(E2E_USERS[1].username);

      await Promise.all([
        openBotSettings(jeremiasPage),
        openBotSettings(yeudyPage),
      ]);

      await Promise.all([
        expectBotGridToMatchApi(jeremiasPage, jeremiasSnapshot.bots),
        expectBotGridToMatchApi(yeudyPage, yeudySnapshot.bots),
      ]);

      const jeremiasDisabledBots = jeremiasSnapshot.bots.filter((bot) => {
        const status = normalizeBotState(bot);
        return status === "disabled" || status === "archived";
      });
      const yeudyDisabledBots = yeudySnapshot.bots.filter((bot) => {
        const status = normalizeBotState(bot);
        return status === "disabled" || status === "archived";
      });

      await Promise.all([
        applyStatusFilter(jeremiasPage, "disabled"),
        applyStatusFilter(yeudyPage, "disabled"),
      ]);

      await Promise.all([
        expectBotGridToMatchApi(jeremiasPage, jeremiasDisabledBots),
        expectBotGridToMatchApi(yeudyPage, yeudyDisabledBots),
      ]);
    } finally {
      await Promise.allSettled([
        jeremiasContext.close(),
        yeudyContext.close(),
      ]);
    }
  });

  test("clears visible bot state when switching users in the same browser context", async ({ page }) => {
    await login(page, E2E_USERS[0]);
    await openBotSettings(page);
    const firstSnapshot = await fetchSessionSnapshot(page);
    await expectBotGridToMatchApi(page, firstSnapshot.bots);

    await logout(page);

    await login(page, E2E_USERS[1]);
    await openBotSettings(page);
    const secondSnapshot = await fetchSessionSnapshot(page);
    await expectBotGridToMatchApi(page, secondSnapshot.bots);
  });
});
