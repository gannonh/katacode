import { request } from "node:http";
import { assertDockerDaemonReachable, assertKatacodeImageBuilt } from "../../src/harness/env.ts";
import { E2E_TAGS } from "../../src/config/tags.ts";
import { E2E_TIMEOUTS } from "../../src/config/timeouts.ts";
import { openConnectionsSettings } from "../../src/flows/settings.ts";
import { dismissBlockingToasts } from "../../src/flows/navigation.ts";
import { expect, test } from "../../src/harness/testFixtures.ts";

/**
 * Container deployment target — provisions the real `katacode:local` image
 * (built by `pnpm run build:docker-image`) running `katacode serve`, then
 * verifies the in-container Kata server boots and is reachable over loopback
 * (AC-1.10: server boots container-side; the full agent-turn slice needs a
 * paired model provider and is recorded as a manual UAT per the spec's
 * two-client rule).
 */

/** Resolve the host port from a loopback httpBaseUrl like `http://localhost:32789`. */
function parseHostPort(httpBaseUrl: string): number {
  const port = Number(new URL(httpBaseUrl).port);
  if (!Number.isFinite(port) || port === 0) {
    throw new Error(`Could not parse host port from session httpBaseUrl: ${httpBaseUrl}`);
  }
  return port;
}

/** Probe the provisioned container's /healthz over the published loopback port. */
async function probeContainerHealth(hostPort: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const req = request(
      { hostname: "127.0.0.1", port: hostPort, path: "/healthz", method: "GET", timeout: 5_000 },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      },
    );
    req.on("error", (error) => reject(new Error(`healthz probe failed: ${error.message}`)));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`healthz probe timed out on port ${hostPort}`));
    });
    req.end();
  });
}

const REAL_IMAGE_E2E_TIMEOUT_MS = Math.max(E2E_TIMEOUTS.agentTestMs, 240_000);

test.describe(`Environments/deployments container target ${E2E_TAGS.environmentsDeploy}`, () => {
  test.describe.configure({ timeout: REAL_IMAGE_E2E_TIMEOUT_MS });

  test("add deployment target, test connection + start session boot the real katacode image", async ({
    appWindow,
  }, testInfo) => {
    // Fail loud if Docker or the katacode image isn't available — the flow
    // provisions the real Kata server, so either is a hard prerequisite.
    await assertDockerDaemonReachable();
    await assertKatacodeImageBuilt();

    const page = appWindow;
    await openConnectionsSettings(page);
    await dismissBlockingToasts(page);

    // Add a container deployment target via the dialog. Defaults are the real
    // katacode:local image + `katacode serve --port 13773`, so only the label
    // is filled.
    await page.getByRole("button", { name: "Add deployment target" }).click();
    const dialog = page.getByRole("dialog", { name: "Add container deployment target" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Label").fill("E2E Smoke");
    // Fill image + command explicitly (the dialog defaults to these, but set
    // them so the test does not depend on default resolution under load).
    await dialog.getByLabel("Image").fill("katacode:local");
    await dialog.getByLabel("Start command").fill("katacode serve --port 13773");
    await dialog.getByRole("button", { name: "Add target" }).click();
    await expect(dialog).toBeHidden();

    // The target card materializes; listInstances reports it available.
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

    // Test connection: validate -> provision -> dispose -> done, all ok. The
    // provision step boots the real katacode image and waits for /healthz, so
    // `provision: ok` proves the in-container server reached readiness.
    await card.getByRole("button", { name: "Test connection" }).click();
    const progress = card.locator("pre");
    await expect(progress).toContainText("validate: ok", { timeout: E2E_TIMEOUTS.agentReplyMs });
    await expect(progress).toContainText("provision: ok", { timeout: E2E_TIMEOUTS.agentReplyMs });
    await expect(progress).toContainText("dispose: ok", { timeout: E2E_TIMEOUTS.agentReplyMs });
    await expect(progress).toContainText("done: ok", { timeout: E2E_TIMEOUTS.agentReplyMs });

    // Start session (AC-1.10): provision the real katacode image, auto-register
    // with Connect using the signed-in app user's Clerk relay token, and surface
    // the loopback endpoint + environmentId.
    await dismissBlockingToasts(page);
    await card.getByRole("button", { name: "Start session" }).click();
    const sessionLine = card.getByText(/Session ready:/);
    await expect(sessionLine).toBeVisible({ timeout: E2E_TIMEOUTS.agentReplyMs });
    await sessionLine.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("session-ready.png"), fullPage: true });

    // Extract the published loopback URL and verify the in-container Kata
    // server answers over it — the loopback reachability half of AC-1.10.
    const sessionText = await sessionLine.textContent();
    const httpBaseUrlMatch = sessionText?.match(/http:\/\/localhost:\d+/);
    expect(
      httpBaseUrlMatch,
      `session text did not expose a loopback URL: ${sessionText}`,
    ).not.toBeNull();
    const hostPort = parseHostPort(httpBaseUrlMatch![0]);
    const healthStatus = await probeContainerHealth(hostPort);
    expect(healthStatus).toBe(200);

    // Dispose the session — the container is released and the session line
    // disappears (AC-1.12 single-client slice).
    await card.getByRole("button", { name: "Dispose" }).click();
    await expect(sessionLine).toBeHidden({ timeout: E2E_TIMEOUTS.assertionMs });

    // Clean up the target via the trash button on the card row.
    await dismissBlockingToasts(page);
    await card.getByRole("button", { name: /Delete deployment target/ }).click();
    await expect(card).toBeHidden({ timeout: E2E_TIMEOUTS.assertionMs });
  });
});
