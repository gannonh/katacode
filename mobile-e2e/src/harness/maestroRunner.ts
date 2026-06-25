import { spawn, spawnSync } from "node:child_process";

import { toMaestroTag } from "../config/tags.ts";
import { formatMissingPrerequisiteError } from "./env.ts";
import { logHarnessPhase } from "./log.ts";
import { gracefulKill } from "./processSpawn.ts";

export interface MaestroRunOptions {
  /** Maestro flow file paths to run (Maestro does not recurse subdirectories). */
  readonly flowPaths: readonly string[];
  /** Tags to filter on; `@`-prefixed or bare both accepted. */
  readonly includeTags?: readonly string[];
  /** Variables injected into flows via `-e KEY=VALUE` (`${KEY}` interpolation). */
  readonly env?: Record<string, string>;
  readonly format?: "junit" | "noop";
  readonly outputPath?: string;
  /** Directory for Maestro screenshots / view hierarchy on failure. */
  readonly debugOutputPath?: string;
  /** Bound on the whole `maestro test` invocation; kills the run on expiry. */
  readonly timeoutMs?: number;
}

/** Build the argv for `maestro <args>`. Pure so the mapping is unit-tested. */
export function buildMaestroArgs(options: MaestroRunOptions): string[] {
  const args: string[] = ["test"];

  if (options.includeTags && options.includeTags.length > 0) {
    args.push("--include-tags", options.includeTags.map(toMaestroTag).join(","));
  }
  if (options.format) {
    args.push("--format", options.format);
  }
  if (options.outputPath) {
    args.push("--output", options.outputPath);
  }
  if (options.debugOutputPath) {
    args.push("--debug-output", options.debugOutputPath);
  }
  for (const [key, value] of Object.entries(options.env ?? {})) {
    args.push("-e", `${key}=${value}`);
  }

  args.push(...options.flowPaths);
  return args;
}

export function assertMaestroInstalled(): void {
  const result = spawnSync("maestro", ["--version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${formatMissingPrerequisiteError("Maestro CLI", ["maestro"])} Install with: curl -fsSL "https://get.maestro.mobile.dev" | bash`,
    );
  }
}

export interface MaestroResult {
  readonly code: number | null;
}

/** Run Maestro, streaming its reporter output to the terminal. */
export async function runMaestro(
  options: MaestroRunOptions,
  spawnEnv: NodeJS.ProcessEnv,
): Promise<MaestroResult> {
  const args = buildMaestroArgs(options);
  logHarnessPhase(`maestro ${args.join(" ")}`);
  return await new Promise<MaestroResult>((resolve, reject) => {
    const child = spawn("maestro", args, { stdio: "inherit", env: spawnEnv });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code }));

    if (options.timeoutMs) {
      const timer = setTimeout(() => {
        logHarnessPhase(`maestro timed out after ${options.timeoutMs}ms; killing run`);
        void gracefulKill({ child, primarySignal: "SIGTERM", graceMs: 5_000 })
          .catch(() => {
            /* settled via close below */
          })
          .finally(() => resolve({ code: 124 }));
      }, options.timeoutMs);
      timer.unref();
      child.once("close", () => clearTimeout(timer));
    }
  });
}
