import { E2E_TAGS } from "../../src/config/tags.ts";
import {
  assertNoFatalLaunchErrors,
  expectAppSurfaceVisible,
  trackFatalLaunchErrors,
} from "../../src/assertions/appAssertions.ts";
import { test } from "../../src/harness/testFixtures.ts";

test.describe(`App launch ${E2E_TAGS.smoke}`, () => {
  test("launches Electron past pairing and reaches the app shell", async ({ appWindow }) => {
    const readFatalErrors = trackFatalLaunchErrors(appWindow);
    await expectAppSurfaceVisible(appWindow);
    assertNoFatalLaunchErrors(readFatalErrors());
  });
});
