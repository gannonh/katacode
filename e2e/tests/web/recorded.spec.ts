/**
 * Starter template for recording web app tests with Playwright codegen.
 *
 * Workflow:
 *   1. Start the full dev stack:  pnpm run dev
 *      (or let the fixture start it — see webSetup.ts)
 *   2. Record a new test:         npx playwright codegen --config e2e/playwright.codegen.config.ts
 *   3. Interact with the app in the browser — Playwright records your actions.
 *   4. Copy the generated code into a file under e2e/tests/web/.
 *   5. Run:                       npx playwright test --config e2e/playwright.config.ts --project web-dev
 *
 * The `webPage` fixture handles server startup, pairing URL capture, and
 * authentication. Tests receive an authenticated page with the app shell
 * ready. Replace or extend the test below with your recorded actions.
 */
import { webTest as test, expect } from "../../src/harness/webSetup.ts";

test.describe("Web app - recorded tests", () => {
  test("app loads and shows the authenticated shell", async ({ webPage }) => {
    // webPage is already authenticated and on "/" with the app shell visible.
    await expect(webPage.getByTestId("command-palette-trigger")).toBeVisible();
  });

  // Paste your codegen-recorded tests below this line.
  // Each recorded test should be a separate `test(...)` block.
  // Use `webPage` instead of `page` to get an authenticated page.
});
