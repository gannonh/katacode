import { test as base, expect, type ElectronApplication, type Page } from "@playwright/test";

import { launchApp, type LaunchedApp } from "./appLaunch.ts";
import { writeRunManifest } from "./artifacts.ts";
import { assertMacOsHost } from "./env.ts";
import {
  cleanupRunState,
  createIsolatedRun,
  type E2ERunContext,
  type LaunchTarget,
} from "./isolatedRun.ts";

export interface E2EFixtures {
  launchTarget: LaunchTarget;
  runContext: E2ERunContext;
  launchedApp: LaunchedApp;
  electronApp: ElectronApplication;
  appWindow: Page;
}

export const test = base.extend<E2EFixtures>({
  // oxlint-disable-next-line eslint(no-empty-pattern) -- Playwright fixture with no upstream dependencies
  launchTarget: async ({}, use, testInfo) => {
    const metadata = testInfo.project.metadata as { launchTarget?: LaunchTarget };
    const launchTarget = metadata.launchTarget ?? "dev";
    await use(launchTarget);
  },
  runContext: async ({ launchTarget }, use, testInfo) => {
    assertMacOsHost();
    const context = await createIsolatedRun({
      projectName: testInfo.project.name,
      launchTarget,
    });
    await writeRunManifest(context);
    await use(context);
    await cleanupRunState(context);
  },
  launchedApp: async ({ runContext }, use) => {
    const launched = await launchApp(runContext);
    await use(launched);
  },
  electronApp: async ({ launchedApp }, use) => {
    await use(launchedApp.electronApp);
  },
  appWindow: async ({ launchedApp }, use) => {
    await use(launchedApp.window);
  },
});

export { expect };
