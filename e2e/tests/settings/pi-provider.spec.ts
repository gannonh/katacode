import { E2E_TAGS } from "../../src/config/tags.ts";
import { E2E_TIMEOUTS } from "../../src/config/timeouts.ts";
import { dismissBlockingToasts } from "../../src/flows/navigation.ts";
import { openProviderSettings } from "../../src/flows/settings.ts";
import { createOrOpenProject, createSeededWorkspace } from "../../src/flows/workspace.ts";
import { expect, test } from "../../src/harness/testFixtures.ts";

test.describe(`Settings Pi provider ${E2E_TAGS.settings}`, () => {
  test("adds Pi as an enabled first-party provider instance", async ({
    authenticatedAppWindow,
  }) => {
    const page = authenticatedAppWindow;
    await openProviderSettings(page);

    // Pi is the first provider heading on the Providers page (AC 1, ordering).
    const providerHeadings = page.getByRole("heading", { level: 3 });
    await expect(providerHeadings.first()).toHaveText("Pi");
    await expect(page.getByRole("switch", { name: "Enable Pi" })).toBeChecked();

    await page.getByLabel("Add provider instance").click();
    const dialog = page.getByRole("dialog", { name: "Add provider instance" });
    await expect(dialog).toBeVisible();

    const piDriver = dialog.getByRole("radio", { name: "Pi Early Access" });
    // Encode the "Pi is first in provider settings" acceptance criterion: a
    // non-Pi-first ordering regression fails this assertion before selection.
    await expect(dialog.getByRole("radio").first()).toHaveAccessibleName("Pi Early Access");
    await expect(piDriver).toBeEnabled();
    await piDriver.click();

    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByLabel("Label").fill("E2E Pi");
    await expect(dialog.getByLabel("Instance ID")).toHaveValue("pi_e2e_pi");

    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByRole("button", { name: "Add instance" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("E2E Pi")).toBeVisible();
    await expect(page.locator("code", { hasText: "pi_e2e_pi" })).toBeVisible();
  });

  test("surfaces a Pi rail in the composer model picker", async ({
    authenticatedAppWindow,
    runContext,
  }) => {
    const page = authenticatedAppWindow;
    // Open a project through the command palette so the composer is reachable,
    // then open the model picker. The Pi provider rail must appear in the
    // picker sidebar (AC 4).
    const seededPath = await createSeededWorkspace(runContext, "pi-picker-rail");
    await createOrOpenProject(page, seededPath);
    await dismissBlockingToasts(page);

    await page.locator('[data-chat-provider-model-picker="true"]').click();
    const modelList = page.locator(".model-picker-list");
    await modelList.waitFor({ state: "visible", timeout: E2E_TIMEOUTS.assertionMs });

    // The Pi provider rail button is present and enabled in the picker sidebar.
    const piRail = page
      .locator('[data-model-picker-sidebar="true"]')
      .getByRole("button", { name: "Pi", exact: true });
    await expect(piRail).toBeVisible({ timeout: E2E_TIMEOUTS.assertionMs });
    await expect(piRail).toBeEnabled({ timeout: E2E_TIMEOUTS.assertionMs });
  });
});
