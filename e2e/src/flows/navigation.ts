import type { Page } from "@playwright/test";

export async function openSettings(page: Page): Promise<void> {
  await page.goto("/settings/general");
  await page.getByRole("heading", { name: "Settings" }).waitFor({ state: "visible" });
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
