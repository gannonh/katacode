import { assert, describe, it } from "@effect/vitest";

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  createDevelopmentLauncherScript,
  createDevelopmentLauncherShim,
} from "./electron-launcher.mjs";

function runLauncherScript(args) {
  const tempDir = mkdtempSync(join(tmpdir(), "kata-electron-launcher-test-"));
  const scriptPath = join(tempDir, "Electron");

  try {
    writeFileSync(
      scriptPath,
      createDevelopmentLauncherScript({
        envEntries: [],
        electronBinaryPath: "/bin/echo",
        shimEntryPath: "/tmp/katacode-dev-main.cjs",
      }),
    );
    chmodSync(scriptPath, 0o755);
    return spawnSync(scriptPath, args, { encoding: "utf8" });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("electron development launcher", () => {
  it("includes a shim that can catch macOS open-url callbacks before main loads", () => {
    const shim = createDevelopmentLauncherShim();

    assert.include(shim, 'app.on("open-url"');
    assert.include(shim, "KATACODE_DESKTOP_DEV_MAIN_ENTRY");
    assert.include(shim, "require(mainEntryPath)");
  });

  it("does not start Electron when auth callback forwarding is unavailable", () => {
    const result = runLauncherScript([
      "katacode-dev://auth/callback?katacode_state=state&rotating_token_nonce=nonce",
    ]);

    assert.equal(result.status, 1);
    assert.notInclude(result.stdout, "/tmp/katacode-dev-main.cjs");
    assert.include(result.stderr, "Kata Code dev auth callback URL is not configured.");
  });

  it("starts Electron for regular development launches", () => {
    const result = runLauncherScript(["--opened-from-dock"]);

    assert.equal(result.status, 0);
    assert.include(result.stdout, "/tmp/katacode-dev-main.cjs --opened-from-dock");
  });
});
