import { defineConfig } from "@playwright/test";

const localBaseURL = "http://127.0.0.1:4185";
const baseURL = process.env.E2E_BASE_URL || localBaseURL;
const projects = [
  {
    name: "chrome",
    use: {
      browserName: "chromium",
      channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || "chrome",
    },
  },
];

if (process.env.PLAYWRIGHT_ENABLE_WEBKIT === "1") {
  projects.push({
    name: "webkit",
    use: {
      browserName: "webkit",
    },
  });
}

if (process.env.PLAYWRIGHT_ENABLE_FIREFOX === "1") {
  projects.push({
    name: "firefox",
    use: {
      browserName: "firefox",
    },
  });
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    headless: true,
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects,
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "vercel dev --listen 127.0.0.1:4185",
        url: localBaseURL,
        timeout: 120_000,
        reuseExistingServer: true,
      },
});
