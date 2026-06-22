import type { Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

import {
  formatMissingPrerequisiteError,
  readClerkPrerequisites,
  readGoogleTestUserPrerequisites,
} from "../harness/env.ts";
import { E2E_TIMEOUTS } from "../config/timeouts.ts";

export function assertAuthPrerequisites(phase: string): void {
  const clerk = readClerkPrerequisites();
  if (!clerk.ok) {
    throw new Error(formatMissingPrerequisiteError(phase, clerk.missing));
  }

  const google = readGoogleTestUserPrerequisites();
  if (!google.ok) {
    throw new Error(formatMissingPrerequisiteError(phase, google.missing));
  }
}

export async function prepareClerkTestingToken(page: Page): Promise<void> {
  assertAuthPrerequisites("Clerk auth");
  await setupClerkTestingToken({ page });
}

export async function openCloudSignInPrompt(page: Page): Promise<void> {
  await page
    .getByTestId("command-palette-trigger")
    .waitFor({ state: "visible", timeout: E2E_TIMEOUTS.assertionMs });

  const connectSignIn = page.getByRole("button", { name: /Sign in to Kata Code Connect/i });
  if (await connectSignIn.isVisible().catch(() => false)) {
    await connectSignIn.click();
  }

  const waitlistSignIn = page.getByRole("button", { name: /^Sign in$/i });
  if (await waitlistSignIn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await waitlistSignIn.click();
  }
}

export async function signInWithClerkGoogleTestUser(page: Page): Promise<void> {
  assertAuthPrerequisites("Google test-user auth");
  await prepareClerkTestingToken(page);
  await openCloudSignInPrompt(page);

  const signInButton = page.getByRole("button", { name: /Continue with Google/i });
  await signInButton.waitFor({ state: "visible", timeout: E2E_TIMEOUTS.authMs });
  await signInButton.click();

  const email = process.env.KATACODE_E2E_GOOGLE_EMAIL?.trim();
  const password = process.env.KATACODE_E2E_GOOGLE_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error(
      formatMissingPrerequisiteError("Google test-user auth", [
        "KATACODE_E2E_GOOGLE_EMAIL",
        "KATACODE_E2E_GOOGLE_PASSWORD",
      ]),
    );
  }

  const googleEmailField = page.getByLabel(/email|phone/i);
  if (await googleEmailField.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await googleEmailField.fill(email);
    await page.getByRole("button", { name: /next/i }).click();
    const passwordField = page.getByLabel(/password/i);
    await passwordField.fill(password);
    await page.getByRole("button", { name: /next/i }).click();
  }

  await page
    .getByRole("button", { name: /user menu|account/i })
    .or(page.locator(".cl-userButton-root"))
    .first()
    .waitFor({ timeout: E2E_TIMEOUTS.authMs })
    .catch(() => {
      throw new Error(
        "Google test-user auth: Clerk did not reach a signed-in state. Confirm environment pairing completed, then verify the Google test user, OAuth consent, and Clerk testing token configuration documented in e2e/README.md.",
      );
    });
}

export async function expectSignedInClerkState(page: Page): Promise<void> {
  assertAuthPrerequisites("signed-in Clerk verification");
  await page
    .locator(".cl-userButton-root")
    .first()
    .waitFor({ state: "visible", timeout: E2E_TIMEOUTS.authMs });
}
