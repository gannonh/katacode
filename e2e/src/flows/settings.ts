import { expect, type Page } from "@playwright/test";

import { dismissBlockingToasts } from "./navigation.ts";

export type ThemePreference = "system" | "light" | "dark";

export async function setTheme(page: Page, theme: ThemePreference): Promise<void> {
  await dismissBlockingToasts(page);
  const trigger = page.getByLabel("Theme preference");
  await trigger.click();
  const label = theme === "system" ? "System" : theme === "light" ? "Light" : "Dark";
  await page.getByRole("option", { name: label }).click();
  await expectResolvedTheme(page, theme === "dark" ? "dark" : "light");
}

export async function expectResolvedTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  if (theme === "dark") {
    await expect(page.locator("html")).toHaveClass(/dark/);
    return;
  }

  await expect(page.locator("html")).not.toHaveClass(/dark/);
}
