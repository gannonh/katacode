import type { Page } from "@playwright/test";

import { E2E_TIMEOUTS } from "../config/timeouts.ts";

export function resolveAppRouteUrl(page: Page, route: string): string {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  const currentUrl = page.url();

  if (currentUrl && !currentUrl.startsWith("about:")) {
    try {
      const url = new URL(currentUrl);
      url.hash = `#${normalizedRoute}`;
      url.search = "";
      return url.href;
    } catch {
      // fall through
    }
  }

  throw new Error(
    `E2E navigation: cannot resolve in-app route ${normalizedRoute} from page URL ${currentUrl || "(empty)"}.`,
  );
}

export async function dismissBlockingToasts(page: Page): Promise<void> {
  const closeButtons = page.locator('[data-slot="toast-close"]');
  while (
    await closeButtons
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await closeButtons
      .first()
      .click()
      .catch(() => undefined);
  }
}

export async function openSettings(page: Page): Promise<void> {
  const themePreference = page.getByLabel("Theme preference");
  if (await themePreference.isVisible().catch(() => false)) {
    return;
  }

  await page.locator('[data-sidebar="menu-button"]', { hasText: "Settings" }).click();
  await dismissBlockingToasts(page);
  await themePreference.waitFor({ state: "visible", timeout: E2E_TIMEOUTS.authMs });
}

export async function openCommandPalette(page: Page): Promise<void> {
  const trigger = page.getByTestId("command-palette-trigger");
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
    return;
  }

  await page.keyboard.press("Meta+K");
  await page.getByTestId("command-palette").waitFor({ state: "visible" });
}
