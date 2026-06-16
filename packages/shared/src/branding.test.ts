import { assert, describe, it } from "@effect/vitest";

import {
  DEFAULT_HOME_DIR_NAME,
  ENV_PREFIX,
  WORKTREE_BRANCH_PREFIX,
  envKey,
  formatAppDisplayName,
  formatUpstreamAppDisplayName,
  resolveAppBranding,
  resolveDefaultKatacodeHome,
  resolveLegacyUserDataDirNames,
} from "./branding.ts";

describe("branding", () => {
  it("exposes canonical identity constants", () => {
    assert.equal(DEFAULT_HOME_DIR_NAME, ".katacode");
    assert.equal(ENV_PREFIX, "KATACODE_");
    assert.equal(WORKTREE_BRANCH_PREFIX, "katacode");
    assert.equal(envKey("HOME"), "KATACODE_HOME");
  });

  it("resolves the default home directory", () => {
    assert.equal(resolveDefaultKatacodeHome("/Users/alice"), "/Users/alice/.katacode");
  });

  it("builds display names from stage labels", () => {
    assert.equal(formatAppDisplayName("Dev"), "KataCode (Dev)");
    assert.equal(formatUpstreamAppDisplayName("Alpha"), "T3 Code (Alpha)");
  });

  it("resolves app branding for hosted and desktop contexts", () => {
    assert.deepEqual(
      resolveAppBranding({
        isDevelopment: false,
        appVersion: "0.0.27",
        hostedAppChannel: "nightly",
      }),
      {
        baseName: "KataCode",
        stageLabel: "Nightly",
        displayName: "KataCode (Nightly)",
      },
    );
  });

  it("includes upstream and fork legacy userData folder names", () => {
    assert.deepEqual(
      resolveLegacyUserDataDirNames({
        isDevelopment: false,
        appVersion: "0.0.27",
      }),
      ["KataCode (Alpha)", "T3 Code (Alpha)"],
    );
  });
});
