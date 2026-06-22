import { access } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";

import { appendProcessLog } from "./artifacts.ts";
import { E2E_TIMEOUTS } from "../config/timeouts.ts";
import { waitForAppEnvironmentReady } from "../flows/pairing.ts";
import { cleanupStaleDesktopDevApps } from "./cleanupStaleDesktopDev.ts";
import { startDevStack } from "./devStack.ts";
import type { E2ERunContext } from "./isolatedRun.ts";
import { registerCleanup } from "./isolatedRun.ts";
import { withTimeout } from "./withTimeout.ts";
import { resolveReleaseExecutablePath } from "./releaseTarget.ts";
import { buildElectronLaunchEnv, isRendererWindow, resolveRendererTarget } from "./launchEnv.ts";

function logLaunchPhase(message: string): void {
  process.stdout.write(`[e2e] ${message}\n`);
}

async function resolveDevElectronLaunchCommand(
  args: string[],
): Promise<{ readonly electronPath: string; readonly args: string[] }> {
  const { resolveRawElectronLaunchCommand } =
    await import("../../../apps/desktop/scripts/electron-launcher.mjs");
  // The macOS `.app` dev launcher boots a 2s auth-callback shim that exits when
  // Playwright passes `main.cjs`. Use the raw Electron binary like dev-electron.
  return resolveRawElectronLaunchCommand(args);
}

function attachElectronLogging(context: E2ERunContext, app: ElectronApplication): void {
  app.on("window", (page) => {
    page.on("console", (message) => {
      void appendProcessLog(context, "renderer-console", `[${message.type()}] ${message.text()}\n`);
    });
    page.on("pageerror", (error) => {
      void appendProcessLog(
        context,
        "renderer-pageerror",
        `${error.message}\n${error.stack ?? ""}\n`,
      );
    });
  });
}

export interface LaunchedApp {
  readonly electronApp: ElectronApplication;
  readonly window: Page;
}

async function resolveRendererWindow(
  electronApp: ElectronApplication,
  rendererPort: number,
  rendererPortLabel: string,
  timeoutMs: number,
): Promise<Page> {
  const deadline = Date.now() + timeoutMs;

  return await new Promise<Page>((resolve, reject) => {
    const fail = (error: Error) => {
      electronApp.off("close", onClose);
      reject(error);
    };

    const onClose = () => {
      const windowUrls = electronApp.windows().map((page) => page.url());
      fail(
        new Error(
          `Electron exited before the renderer window opened (expected ${rendererPortLabel} on port ${rendererPort}). Last windows: ${windowUrls.join(", ") || "(none)"}`,
        ),
      );
    };

    electronApp.once("close", onClose);

    const poll = async () => {
      while (Date.now() < deadline) {
        for (const page of electronApp.windows()) {
          const url = page.url();
          if (isRendererWindow(url, rendererPort)) {
            electronApp.off("close", onClose);
            resolve(page);
            return;
          }
        }

        await delay(250);
      }

      const windowUrls = electronApp.windows().map((page) => page.url());
      fail(
        new Error(
          `Electron renderer window not found within ${timeoutMs}ms (expected ${rendererPortLabel} on port ${rendererPort}). Open windows: ${windowUrls.join(", ") || "(none)"}`,
        ),
      );
    };

    void poll().catch(fail);
  });
}

export async function launchApp(context: E2ERunContext): Promise<LaunchedApp> {
  const repoDesktopDir = join(context.repoRoot, "apps/desktop");
  const mainBundle = join(repoDesktopDir, "dist-electron/main.cjs");

  if (context.launchTarget === "dev") {
    cleanupStaleDesktopDevApps(context.repoRoot);
    await startDevStack(context);
    await access(mainBundle).catch(() => {
      throw new Error(
        `desktop-dev launch: missing ${mainBundle}. Run "vp run --filter @kata-sh/code-desktop ensure:electron" and build desktop before E2E.`,
      );
    });
  }

  const env = buildElectronLaunchEnv(context);
  const { port: rendererPort, label: rendererPortLabel } = resolveRendererTarget(context);

  const remoteDebuggingPort = context.devEnv.KATACODE_DESKTOP_REMOTE_DEBUGGING_PORT?.trim();
  const launchArgs = [
    ...(remoteDebuggingPort ? [`--remote-debugging-port=${remoteDebuggingPort}`] : []),
    `--katacode-dev-root=${repoDesktopDir}`,
    "dist-electron/main.cjs",
  ];
  logLaunchPhase("Launching Electron...");

  let electronApp: ElectronApplication;
  if (context.launchTarget === "release") {
    electronApp = await electron.launch({
      executablePath: resolveReleaseExecutablePath(),
      env,
    });
  } else {
    const devLaunch = await resolveDevElectronLaunchCommand(launchArgs);
    electronApp = await electron.launch({
      executablePath: devLaunch.electronPath,
      args: devLaunch.args,
      cwd: repoDesktopDir,
      env,
    });
  }
  registerCleanup(context, async () => {
    await electronApp.close();
  });

  attachElectronLogging(context, electronApp);
  logLaunchPhase("Waiting for the Electron renderer window...");
  const window = await withTimeout(
    "Electron renderer window",
    E2E_TIMEOUTS.electronWindowMs,
    () =>
      resolveRendererWindow(
        electronApp,
        rendererPort,
        rendererPortLabel,
        E2E_TIMEOUTS.electronWindowMs,
      ),
    `artifactRoot=${context.artifactRoot}`,
  );
  logLaunchPhase("Electron renderer window is ready.");
  logLaunchPhase("Waiting for embedded API bootstrap...");
  await waitForAppEnvironmentReady(window, context);
  logLaunchPhase("Embedded API bootstrap is ready.");

  return { electronApp, window };
}
