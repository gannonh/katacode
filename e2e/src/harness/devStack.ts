import { type ChildProcess } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createConnection } from "node:net";

import { E2E_TIMEOUTS } from "../config/timeouts.ts";
import type { E2ERunContext } from "./isolatedRun.ts";
import { registerCleanup } from "./isolatedRun.ts";
import { spawnWithArtifactLogs, terminateChildProcess } from "./processSpawn.ts";
import { withTimeout } from "./withTimeout.ts";

export interface DevStackHandle {
  readonly process: ChildProcess;
}

export function buildDevRunnerArgs(input: {
  readonly katacodeHome: string;
  readonly serverPort: number;
  readonly webPort: number;
}): string[] {
  // Vite only. Playwright launches the single Electron instance — dev:desktop would
  // also auto-spawn Electron via dev-electron.mjs and cause duplicate backends/tokens.
  return [
    "scripts/dev-runner.ts",
    "dev:web",
    "--home-dir",
    input.katacodeHome,
    "--no-browser",
    "--port",
    String(input.serverPort),
    "--dev-url",
    `http://127.0.0.1:${input.webPort}`,
  ];
}

export async function waitForTcpPort(
  port: number,
  timeoutMs = E2E_TIMEOUTS.devStackMs,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });

    if (ready) {
      return;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for dev stack port 127.0.0.1:${port}.`);
}

function logLaunchPhase(message: string): void {
  process.stdout.write(`[e2e] ${message}\n`);
}

async function waitForWebDevServer(
  webPort: number,
  timeoutMs = E2E_TIMEOUTS.devStackMs,
): Promise<void> {
  const url = `http://127.0.0.1:${webPort}`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) {
        return;
      }
    } catch {
      // Vite is still booting.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for Vite dev server at ${url}.`);
}

async function readDevStackLogTail(
  context: E2ERunContext,
  label: string,
): Promise<string | undefined> {
  try {
    const log = await readFile(join(context.artifactRoot, `${label}.log`), "utf8");
    const lines = log.trimEnd().split("\n");
    return lines.slice(-20).join("\n");
  } catch {
    return undefined;
  }
}

async function devStackTimeoutDetails(context: E2ERunContext): Promise<string> {
  const stderr = await readDevStackLogTail(context, "dev-stack-stderr");
  const stdout = await readDevStackLogTail(context, "dev-stack-stdout");
  const sections = [
    `artifactRoot=${context.artifactRoot}`,
    stderr ? `dev-stack-stderr (last lines):\n${stderr}` : undefined,
    stdout ? `dev-stack-stdout (last lines):\n${stdout}` : undefined,
  ].filter(Boolean);
  return sections.join("\n\n");
}

async function assertDesktopBuildArtifacts(repoRoot: string): Promise<void> {
  const mainBundle = join(repoRoot, "apps/desktop/dist-electron/main.cjs");
  try {
    await access(mainBundle);
  } catch {
    throw new Error(
      `desktop-dev launch: missing ${mainBundle}. Run "vp run --filter @kata-sh/code-desktop ensure:electron" and build desktop before E2E.`,
    );
  }
}

export async function startDevStack(context: E2ERunContext): Promise<DevStackHandle> {
  return await withTimeout(
    "Dev stack startup",
    E2E_TIMEOUTS.devStackMs,
    async () => startDevStackInner(context),
    () => devStackTimeoutDetails(context),
  );
}

async function startDevStackInner(context: E2ERunContext): Promise<DevStackHandle> {
  await assertDesktopBuildArtifacts(context.repoRoot);

  logLaunchPhase(
    `Starting Vite dev server (web=${context.webPort}, api will be provided by Electron on ${context.serverPort}, home=${context.katacodeHome})`,
  );

  const { process: child } = spawnWithArtifactLogs(context, {
    label: "dev-stack",
    command: process.execPath,
    args: buildDevRunnerArgs({
      katacodeHome: context.katacodeHome,
      serverPort: context.serverPort,
      webPort: context.webPort,
    }),
    cwd: context.repoRoot,
    env: {
      ...context.devEnv,
      HOST: "127.0.0.1",
      PORT: String(context.webPort),
      KATACODE_PORT: String(context.serverPort),
      VITE_DEV_SERVER_URL: `http://127.0.0.1:${context.webPort}`,
      VITE_HTTP_URL: `http://127.0.0.1:${context.serverPort}`,
      VITE_WS_URL: `ws://127.0.0.1:${context.serverPort}`,
    },
  });

  registerCleanup(context, async () => {
    await terminateChildProcess(child);
  });

  logLaunchPhase("Waiting for Vite dev server...");
  await waitForWebDevServer(context.webPort);
  logLaunchPhase("Vite dev server is ready.");

  return { process: child };
}
