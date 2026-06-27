import { type ChildProcess } from "node:child_process";
import type { ElectronApplication, Page } from "@playwright/test";

import { waitForAppEnvironmentReady } from "../flows/pairing.ts";
import { waitForAppShell } from "../flows/shell.ts";
import { dismissBlockingToasts } from "../flows/navigation.ts";
import { expectSignedInClerkState, signInWithClerkGoogleTestUser } from "../flows/auth.ts";
import { E2E_TIMEOUTS } from "../config/timeouts.ts";
import { launchApp, type LaunchedApp } from "./appLaunch.ts";
import { logHarnessPhase } from "./log.ts";
import { writeRunManifest } from "./artifacts.ts";
import { assertMacOsHost } from "./env.ts";
import {
  cleanupRunState,
  createIsolatedRun,
  type E2ERunContext,
  type LaunchTarget,
} from "./isolatedRun.ts";

/**
 * One E2E session shared across every test in a single spec file.
 *
 * Playwright has no native "file" fixture scope: worker-scoped fixtures are
 * shared across every file on the same worker (so `workers: 1` collapses all
 * files into one session, and `workers: N` races on simultaneous launches).
 * This manager provides file-scoped sessions by ref-counting on
 * `testInfo.file`: the first test in a file boots the session (Vite + Electron
 * + Clerk sign-in once), subsequent tests reuse it, and the last test in the
 * file tears it down. Tests run serially within a file (`fullyParallel: false`),
 * so the ref count is never contended.
 *
 * Net effect for the primary single-worker local mode: one launch per file
 * instead of one per test, collapsing the ~1min/test startup cost to once per
 * file while keeping each file's home/provider state fully isolated.
 */
export interface E2ESession {
  readonly runContext: E2ERunContext;
  readonly launchedApp: LaunchedApp;
  readonly electronApp: ElectronApplication;
  readonly appWindow: Page;
  readonly authenticatedAppWindow: Page;
}

interface ManagedSession {
  readonly session: E2ESession;
  refCount: number;
  readonly fileKey: string;
}

const sessionsByFile = new Map<string, ManagedSession>();

function readLaunchTarget(testInfo: {
  project: { name: string; metadata: unknown };
}): LaunchTarget {
  const metadata = testInfo.project.metadata;
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("launchTarget" in metadata) ||
    typeof metadata.launchTarget !== "string" ||
    (metadata.launchTarget !== "dev" && metadata.launchTarget !== "release")
  ) {
    throw new Error(
      `E2E project "${testInfo.project.name}" must define metadata.launchTarget as "dev" or "release".`,
    );
  }
  return metadata.launchTarget as LaunchTarget;
}

async function bootSession(launchTarget: LaunchTarget, fileKey: string): Promise<E2ESession> {
  assertMacOsHost();
  const runContext = await createIsolatedRun({
    projectName: fileKey,
    launchTarget,
  });
  await writeRunManifest(runContext);

  const launchedApp = await launchApp(runContext);
  const appWindow = launchedApp.window;

  logHarnessPhase("Waiting for app environment (server port + app shell)...");
  await waitForAppEnvironmentReady(appWindow, runContext);
  logHarnessPhase("App environment is ready.");

  logHarnessPhase("Signing in with Clerk Google test user...");
  await signInWithClerkGoogleTestUser(appWindow);
  await expectSignedInClerkState(appWindow);
  logHarnessPhase("Authenticated app window is ready.");

  // The sign-in flow can leave the app on the Settings route (avatar fallback).
  // Return to the threads home so every test starts from a known nav state.
  await resetAppToHome(appWindow);

  return {
    runContext,
    launchedApp,
    electronApp: launchedApp.electronApp,
    appWindow,
    authenticatedAppWindow: appWindow,
  };
}

async function disposeSession(managed: ManagedSession): Promise<void> {
  const { runContext, launchedApp } = managed.session;
  // Close the Electron app first so it stops holding the renderer/server ports
  // before the dev stack and home are torn down.
  await launchedApp.electronApp.close().catch(() => undefined);
  await cleanupRunState(runContext);
}

/**
 * Acquire (or reuse) the file's shared session. The first caller boots it; the
 * session is kept alive until the matching {@link releaseFileSession} drops the
 * ref count to zero. `needsAuth` boots through the Clerk sign-in flow; callers
 * that only need the raw app window (e.g. smoke) still share the same session
 * so a file with mixed tests doesn't pay for two launches.
 */
export async function acquireFileSession(
  testInfo: {
    readonly file: string;
    readonly project: { readonly name: string; readonly metadata: unknown };
  },
  options: { readonly needsAuth: boolean },
): Promise<E2ESession> {
  const fileKey = testInfo.file;
  const existing = sessionsByFile.get(fileKey);
  if (existing) {
    existing.refCount += 1;
    return existing.session;
  }

  const launchTarget = readLaunchTarget(testInfo);
  const session = await bootSession(launchTarget, fileKey);
  sessionsByFile.set(fileKey, { session, refCount: 1, fileKey });
  return session;
}

/**
 * Drop one reference to the file's session without disposing it. The session
 * stays cached for the next test in the file. Disposal is deferred to worker
 * teardown ({@link disposeAllSessions}) so a file's tests share one boot.
 */
export function dropFileSessionRef(fileKey: string): void {
  const managed = sessionsByFile.get(fileKey);
  if (!managed) {
    return;
  }
  managed.refCount = Math.max(0, managed.refCount - 1);
}

/**
 * Dispose every cached session. Called once at worker teardown so no Electron
 * app, Vite dev stack, or isolated home outlives the run. With `workers: 1`
 * this is the single end-of-run cleanup; with `workers: N` each worker disposes
 * its own sessions independently.
 */
export async function disposeAllSessions(): Promise<void> {
  const pending = [...sessionsByFile.values()];
  sessionsByFile.clear();
  for (const managed of pending) {
    await disposeSession(managed);
  }
}

/**
 * Reset the shared app window to a neutral home-shell state between tests in
 * the same file: dismiss leftover toasts and navigate to the threads home route
 * so the next test starts from a known navigation point. Cheap relative to a
 * full re-launch; wire it as a shared `beforeEach` for multi-test files.
 */
export async function resetAppToHome(page: Page): Promise<void> {
  await dismissBlockingToasts(page);
  // The sidebar wordmark link navigates to the threads home route from any view.
  const home = page.getByRole("link", { name: "Go to threads" });
  if (await home.isVisible().catch(() => false)) {
    await home.click().catch(() => undefined);
  }
  await dismissBlockingToasts(page);
  await waitForAppShell(page, E2E_TIMEOUTS.assertionMs);
}
