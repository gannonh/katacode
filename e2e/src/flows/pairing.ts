import { setTimeout as delay } from "node:timers/promises";
import type { Page } from "@playwright/test";

import { E2E_TIMEOUTS } from "../config/timeouts.ts";
import { waitForTcpPort } from "../harness/devStack.ts";
import type { E2ERunContext } from "../harness/isolatedRun.ts";

const PAIRING_BLOCKING_HEADING = /Pair with this environment/i;

async function waitForAppShell(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const pairingVisible = await page
      .getByRole("heading", { name: PAIRING_BLOCKING_HEADING })
      .isVisible()
      .catch(() => false);

    if (pairingVisible) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await delay(500);
      continue;
    }

    const appShellVisible = await page
      .getByTestId("command-palette-trigger")
      .isVisible()
      .catch(() => false);
    if (appShellVisible) {
      return;
    }

    await delay(250);
  }

  throw new Error(
    "E2E pairing: app stayed on the pairing gate or never reached the main shell within the timeout.",
  );
}

export async function waitForAppEnvironmentReady(
  page: Page,
  context: E2ERunContext,
): Promise<void> {
  await waitForTcpPort(context.serverPort, E2E_TIMEOUTS.pairingMs);
  await waitForAppShell(page, E2E_TIMEOUTS.pairingMs);
}
