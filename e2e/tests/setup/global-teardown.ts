import { reapAllSpawnedStacks } from "../../src/harness/spawnRegistry.ts";

/**
 * Playwright global teardown: reap any dev stacks still tracked after the run.
 * Per-test fixture teardown handles the normal path; this catches stacks left
 * behind by a fixture that threw mid-teardown so nothing leaks past the run.
 */
export default function globalTeardown(): void {
  reapAllSpawnedStacks();
}
