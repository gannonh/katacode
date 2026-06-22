import { E2E_TAGS } from "../../src/config/tags.ts";
import { expectSignedInClerkState, signInWithClerkGoogleTestUser } from "../../src/flows/auth.ts";
import { openSettings } from "../../src/flows/navigation.ts";
import { expectResolvedTheme, setTheme } from "../../src/flows/settings.ts";
import { test } from "../../src/harness/testFixtures.ts";

test.describe(`Settings theme ${E2E_TAGS.settings}`, () => {
  test("persists dark theme after reload", async ({ appWindow }) => {
    await signInWithClerkGoogleTestUser(appWindow);
    await expectSignedInClerkState(appWindow);
    await openSettings(appWindow);
    await setTheme(appWindow, "dark");
    await appWindow.reload();
    await openSettings(appWindow);
    await expectResolvedTheme(appWindow, "dark");
  });
});
