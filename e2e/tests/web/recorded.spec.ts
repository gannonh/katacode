/**
 * Starter template for recording web app tests with Playwright codegen.
 *
 * Workflow:
 *   1. Start the web app:  pnpm run dev:web
 *   2. Open codegen:       npx playwright codegen http://localhost:5733 --config e2e/playwright.codegen.config.ts
 *   3. Interact with the app in the browser — Playwright records your actions.
 *   4. Copy the generated code into this file (or a new file under e2e/tests/web/).
 *   5. Run:                npx playwright test --config e2e/playwright.codegen.config.ts
 *
 * The test below opens the app and verifies the page loads. Replace or extend it
 * with your recorded actions.
 */
import { test, expect } from "@playwright/test";

test.describe("Web app - recorded tests", () => {
  test("app loads and shows the main UI", async ({ page }) => {
    await page.goto("/");
    // Wait for the app to hydrate — adjust the selector to match a stable element.
    // The command palette trigger is present on both Electron and web.
    await expect(page.getByTestId("command-palette-trigger")).toBeVisible({
      timeout: 15_000,
    });
  });

  // Paste your codegen-recorded tests below this line.
  // Each recorded test should be a separate `test(...)` block.
});
