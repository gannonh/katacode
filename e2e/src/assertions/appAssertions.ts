import type { Page } from "@playwright/test";

import { E2E_TIMEOUTS } from "../config/timeouts.ts";

export async function expectAppSurfaceVisible(page: Page): Promise<void> {
  await page
    .getByTestId("command-palette-trigger")
    .waitFor({ state: "visible", timeout: E2E_TIMEOUTS.assertionMs });
}

export function trackFatalLaunchErrors(page: Page): () => readonly string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return () => errors;
}

export function assertNoFatalLaunchErrors(errors: readonly string[]): void {
  const fatalPatterns = [
    "Cannot find module",
    "MODULE_NOT_FOUND",
    "Uncaught Error",
    "Uncaught TypeError",
    "Uncaught ReferenceError",
  ];

  const failures = errors.filter((entry) =>
    fatalPatterns.some((pattern) => entry.includes(pattern)),
  );

  if (failures.length > 0) {
    throw new Error(`Fatal renderer errors during launch:\n${failures.join("\n")}`);
  }
}
