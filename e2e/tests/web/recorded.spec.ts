/**
 * Starter template for recording web app tests with Playwright codegen.
 *
 * Workflow:
 *   1. Start the full dev stack:  pnpm run dev
 *      (or let Playwright start it via the webServer config)
 *   2. Record a new test:         npx playwright codegen --config e2e/playwright.codegen.config.ts
 *   3. Interact with the app in the browser — Playwright records your actions.
 *   4. Copy the generated code into a file under e2e/tests/web/.
 *   5. Run:                       npx playwright test --config e2e/playwright.config.ts --project web
 *
 * The test below verifies the web app loads. Without authentication the app
 * either redirects to the pairing page (when the server is healthy) or shows
 * an error boundary (when the server descriptor fails). Both surfaces render
 * the app name, so we assert against that. Replace or extend with your
 * recorded actions.
 */
import { test, expect } from "@playwright/test";

test.describe("Web app - recorded tests", () => {
  test("app loads and renders the app shell", async ({ page }) => {
    await page.goto("/");

    // The app name is present in all states: pairing page, error boundary,
    // and the authenticated app shell. This is a minimal smoke check that
    // the web bundle loaded and React hydrated.
    await expect(page.getByText(/Kata Code/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  // Paste your codegen-recorded tests below this line.
  // Each recorded test should be a separate `test(...)` block.
});
