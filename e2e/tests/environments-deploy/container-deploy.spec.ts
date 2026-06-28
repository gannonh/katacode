import { assertDockerDaemonReachable } from "../../src/harness/env.ts";
import { E2E_TAGS } from "../../src/config/tags.ts";
import { E2E_TIMEOUTS } from "../../src/config/timeouts.ts";
import { openConnectionsSettings } from "../../src/flows/settings.ts";
import { dismissBlockingToasts } from "../../src/flows/navigation.ts";
import { expect, test } from "../../src/harness/testFixtures.ts";

/**
 * Container deployment target — a stub start command that serves /healthz so the
 * driver's readiness probe succeeds without a real katacode image.
 */
const STUB_HEALTH_COMMAND =
  "node -e \"require('http').createServer((q,s)=>{if(q.url==='/healthz'){s.writeHead(200);s.end('ok')}}).listen(13773)\"";

test.describe(`Environments/deployments container target ${E2E_TAGS.environmentsDeploy}`, () => {
  test.describe.configure({ timeout: E2E_TIMEOUTS.agentTestMs });

  test("add deployment target, test connection provisions + disposes a container", async ({
    appWindow,
  }) => {
    // Fail loud if Docker isn't available — the flow provisions real containers.
    await assertDockerDaemonReachable();

    const page = appWindow;
    await openConnectionsSettings(page);
    await dismissBlockingToasts(page);

    // Add a container deployment target via the dialog.
    await page.getByRole("button", { name: "Add deployment target" }).click();
    const dialog = page.getByRole("dialog", { name: "Add container deployment target" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Label").fill("E2E Smoke");
    await dialog.getByLabel("Start command").fill(STUB_HEALTH_COMMAND);
    await dialog.getByRole("button", { name: "Add target" }).click();
    await expect(dialog).toBeHidden();

    // The target card materializes; listInstances reports it available.
    // The card is the border-t div inside the Deployment targets section.
    const section = page
      .getByRole("heading", { name: "Deployment targets", level: 2 })
      .locator("xpath=ancestor::section[1]");
    const card = section.locator("div.border-t").filter({
      has: page.getByRole("heading", { name: "E2E Smoke", level: 3 }),
    });
    await expect(card).toBeVisible({ timeout: E2E_TIMEOUTS.authMs });
    await expect(card.getByText("docker", { exact: true })).toBeVisible();
    await expect(card.getByText("available")).toBeVisible({ timeout: E2E_TIMEOUTS.authMs });

    // Expand the card to reach the config + Test connection controls.
    await card.getByRole("button", { name: /Toggle .* details/ }).click();

    // Test connection: validate -> provision -> dispose -> done, all ok.
    await card.getByRole("button", { name: "Test connection" }).click();
    const progress = card.locator("pre");
    await expect(progress).toContainText("validate: ok", { timeout: E2E_TIMEOUTS.agentReplyMs });
    await expect(progress).toContainText("provision: ok", { timeout: E2E_TIMEOUTS.agentReplyMs });
    await expect(progress).toContainText("dispose: ok", { timeout: E2E_TIMEOUTS.agentReplyMs });
    await expect(progress).toContainText("done: ok", { timeout: E2E_TIMEOUTS.agentReplyMs });

    // Clean up the target via the trash button on the card row.
    await dismissBlockingToasts(page);
    await card.getByRole("button", { name: /Delete deployment target/ }).click();
    await expect(card).toBeHidden({ timeout: E2E_TIMEOUTS.assertionMs });
  });
});
