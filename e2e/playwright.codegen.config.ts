/**
 * Lightweight Playwright config for codegen / recording against the running web app.
 *
 * Usage:
 *   1. Start the full dev stack:  pnpm run dev
 *      (or let Playwright start it via the webServer config below)
 *   2. Record a new test:         npx playwright codegen --config e2e/playwright.codegen.config.ts
 *   3. Run recorded tests:        npx playwright test --config e2e/playwright.config.ts --project web
 *
 * This config targets http://localhost:5733 (the default web dev port).
 * Override with KATACODE_WEB_URL env var if your port differs.
 */
import { defineConfig, devices } from "@playwright/test";

const webUrl = process.env["KATACODE_WEB_URL"] ?? "http://localhost:5733";

export default defineConfig({
  testDir: "./tests/web",
  outputDir: "./test-results/web",
  fullyParallel: true,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { outputFolder: "./playwright-report/web", open: "never" }]],
  use: {
    baseURL: webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "web-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm run dev",
    url: webUrl,
    reuseExistingServer: true,
    timeout: 60_000,
    cwd: "..",
  },
});
