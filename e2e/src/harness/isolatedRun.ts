import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRepoEnv } from "../../../scripts/lib/public-config.ts";
import { findAvailablePortOffset } from "./ports.ts";
import { resolveArtifactRoot } from "./artifacts.ts";

export type LaunchTarget = "dev" | "release";

export interface E2ERunContext {
  readonly runId: string;
  readonly projectName: string;
  readonly launchTarget: LaunchTarget;
  readonly repoRoot: string;
  readonly katacodeHome: string;
  readonly workspaceRoot: string;
  readonly artifactRoot: string;
  readonly serverPort: number;
  readonly webPort: number;
  readonly devEnv: NodeJS.ProcessEnv;
  readonly cleanupCallbacks: Array<() => Promise<void> | void>;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function createRunId(): string {
  return `e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function resolveStartOffset(): number {
  const explicit = Number.parseInt(process.env.KATACODE_PORT_OFFSET ?? "", 10);
  if (Number.isInteger(explicit) && explicit >= 0) {
    return explicit;
  }

  const instance = process.env.KATACODE_DEV_INSTANCE?.trim();
  if (instance && /^\d+$/.test(instance)) {
    return Number(instance);
  }

  return Math.floor(Math.random() * 500) + 100;
}

export async function createIsolatedRun(input: {
  readonly projectName: string;
  readonly launchTarget: LaunchTarget;
}): Promise<E2ERunContext> {
  const runId = createRunId();
  const { offset, serverPort, webPort } = await findAvailablePortOffset(resolveStartOffset());
  const katacodeHome = await mkdtemp(join(tmpdir(), `katacode-e2e-home-${runId}-`));
  const workspaceRoot = await mkdtemp(join(tmpdir(), `katacode-e2e-workspace-${runId}-`));
  const artifactRoot = join(resolveArtifactRoot(), runId);
  const cleanupCallbacks: Array<() => Promise<void> | void> = [];

  const baseEnv = {
    ...process.env,
    ...loadRepoEnv(),
    KATACODE_HOME: katacodeHome,
    KATACODE_PORT_OFFSET: String(offset),
    HOST: "127.0.0.1",
    KATACODE_NO_BROWSER: "1",
    KATACODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD: "0",
  } satisfies NodeJS.ProcessEnv;

  cleanupCallbacks.push(async () => {
    await rm(katacodeHome, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  return {
    runId,
    projectName: input.projectName,
    launchTarget: input.launchTarget,
    repoRoot,
    katacodeHome,
    workspaceRoot,
    artifactRoot,
    serverPort,
    webPort,
    devEnv: baseEnv,
    cleanupCallbacks,
  };
}

export async function cleanupRunState(context: E2ERunContext): Promise<void> {
  for (const callback of [...context.cleanupCallbacks].toReversed()) {
    await callback();
  }
}

export function registerCleanup(
  context: E2ERunContext,
  callback: () => Promise<void> | void,
): void {
  context.cleanupCallbacks.push(callback);
}
