import { test as base, expect, type ElectronApplication, type Page } from "@playwright/test";

import {
  acquireFileSession,
  disposeAllSessions,
  dropFileSessionRef,
  resetAppToHome,
  type E2ESession,
} from "./fileSession.ts";
import type { E2ERunContext } from "./isolatedRun.ts";
import type { LaunchTarget } from "./isolatedRun.ts";

export interface E2EFixtures {
  launchTarget: LaunchTarget;
  /** Shared per-file session. Acquired once per test (ref++), released in
   * teardown (ref--). The first test in a file boots it; the last disposes it. */
  session: E2ESession;
  runContext: E2ERunContext;
  launchedApp: E2ESession["launchedApp"];
  electronApp: ElectronApplication;
  appWindow: Page;
  authenticatedAppWindow: Page;
}

/**
 * Test-scoped fixtures backed by a per-file shared session (see
 * {@link fileSession}). The first test in a file boots one Electron app, one
 * Vite dev stack, one isolated home, and one Clerk sign-in; every subsequent
 * test in that file reuses them. The session is torn down after the file's last
 * test. With `fullyParallel: false`, tests run serially within a file, so the
 * shared session is never contended and each file stays fully isolated from the
 * others. This collapses the per-test startup cost (Vite + Electron + OAuth) to
 * once per file.
 *
 * The session always boots through Clerk sign-in. Unauthed tests (e.g. smoke)
 * share the same authed session; sign-in does not affect the app shell they
 * assert against, so a file mixing authed and unauthed tests pays for one launch.
 */
export const test = base.extend<E2EFixtures, { workerSessionDisposer: void }>({
  // oxlint-disable-next-line eslint(no-empty-pattern) -- Playwright fixture with no upstream dependencies
  launchTarget: async ({}, use, testInfo) => {
    const metadata = testInfo.project.metadata;
    const target =
      typeof metadata === "object" &&
      metadata !== null &&
      "launchTarget" in metadata &&
      typeof metadata.launchTarget === "string"
        ? (metadata.launchTarget as LaunchTarget)
        : undefined;
    if (target !== "dev" && target !== "release") {
      throw new Error(
        `E2E project "${testInfo.project.name}" must define metadata.launchTarget as "dev" or "release".`,
      );
    }
    await use(target);
  },

  // Single owner of the per-test acquire. The session is NOT disposed in this
  // fixture's teardown — it persists across tests in the file so the next test
  // reuses it (acquireFileSession returns the cached session and bumps the ref
  // count). Disposal happens once, at worker end, via workerSessionDisposer.
  session: async ({}, use, testInfo) => {
    const acquired = await acquireFileSession(testInfo, { needsAuth: true });
    await use(acquired);
    // Drop this test's ref but keep the session alive for the file's other tests.
    dropFileSessionRef(testInfo.file);
  },

  // Worker-scoped: runs once when the worker (and therefore all files it ran)
  // finishes. Disposes every cached session so no Electron/Vite/home leaks past
  // the run. With workers:1 this is the single end-of-run teardown.
  workerSessionDisposer: [
    async ({}, use) => {
      await use(undefined);
      await disposeAllSessions();
    },
    { scope: "worker", auto: true },
  ],

  runContext: async ({ session }, use) => {
    await use(session.runContext);
  },

  launchedApp: async ({ session }, use) => {
    await use(session.launchedApp);
  },

  electronApp: async ({ session }, use) => {
    await use(session.electronApp);
  },

  appWindow: async ({ session }, use) => {
    await use(session.appWindow);
  },

  authenticatedAppWindow: async ({ session }, use) => {
    await use(session.authenticatedAppWindow);
  },
});

export { expect, resetAppToHome };
