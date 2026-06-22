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

function logLaunchPhase(message: string): void {
  process.stdout.write(`[e2e] ${message}\n`);
}

async function resolveRepoDesktopDir(repoRoot: string): Promise<string> {
  return join(repoRoot, "apps/desktop");
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

function isRendererWindow(url: string, webPort: number): boolean {
  if (!url || url === "about:blank" || url.startsWith("devtools://")) {
    return false;
  }

  return url.includes(`127.0.0.1:${webPort}`) || url.includes(`localhost:${webPort}`);
}

async function resolveRendererWindow(
  electronApp: ElectronApplication,
  webPort: number,
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
          `Electron exited before the renderer window opened (expected Vite on port ${webPort}). Last windows: ${windowUrls.join(", ") || "(none)"}`,
        ),
      );
    };

    electronApp.once("close", onClose);

    const poll = async () => {
      while (Date.now() < deadline) {
        for (const page of electronApp.windows()) {
          const url = page.url();
          if (isRendererWindow(url, webPort)) {
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
          `Electron renderer window not found within ${timeoutMs}ms (expected Vite on port ${webPort}). Open windows: ${windowUrls.join(", ") || "(none)"}`,
        ),
      );
    };

    void poll().catch(fail);
  });
}

export async function launchApp(context: E2ERunContext): Promise<LaunchedApp> {
  const repoDesktopDir = await resolveRepoDesktopDir(context.repoRoot);
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

  const env: NodeJS.ProcessEnv = {
    ...context.devEnv,
    KATACODE_PORT: String(context.serverPort),
    PORT: String(context.webPort),
    VITE_DEV_SERVER_URL: `http://127.0.0.1:${context.webPort}`,
    VITE_HTTP_URL: `http://127.0.0.1:${context.serverPort}`,
    VITE_WS_URL: `ws://127.0.0.1:${context.serverPort}`,
    ELECTRON_ENABLE_LOGGING: "1",
  };
  delete env.ELECTRON_RUN_AS_NODE;

  const launchArgs = [`--katacode-dev-root=${repoDesktopDir}`, "dist-electron/main.cjs"];
  logLaunchPhase("Launching Electron...");

  const devLaunch =
    context.launchTarget === "release" ? null : await resolveDevElectronLaunchCommand(launchArgs);

  const launchOptions =
    context.launchTarget === "release"
      ? {
          executablePath: resolveReleaseExecutablePath(),
          env,
        }
      : {
          executablePath: devLaunch!.electronPath,
          args: devLaunch!.args,
          cwd: repoDesktopDir,
          env,
        };

  const electronApp = await electron.launch(launchOptions);
  registerCleanup(context, async () => {
    await electronApp.close();
  });

  attachElectronLogging(context, electronApp);
  logLaunchPhase("Waiting for the Electron renderer window...");
  const window = await withTimeout(
    "Electron renderer window",
    E2E_TIMEOUTS.electronWindowMs,
    () => resolveRendererWindow(electronApp, context.webPort, E2E_TIMEOUTS.electronWindowMs),
    `artifactRoot=${context.artifactRoot}`,
  );
  logLaunchPhase("Electron renderer window is ready.");
  logLaunchPhase("Waiting for embedded API bootstrap...");
  await waitForAppEnvironmentReady(window, context);
  logLaunchPhase("Embedded API bootstrap is ready.");

  return { electronApp, window };
}
