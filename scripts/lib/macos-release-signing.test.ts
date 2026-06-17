import { describe, expect, it } from "vite-plus/test";

import {
  MACOS_RELEASE_SIGNING_SECRET_NAMES,
  resolveMacOsReleaseSigning,
} from "./macos-release-signing.ts";

describe("resolveMacOsReleaseSigning", () => {
  it("requires all five macOS release signing secrets", () => {
    expect(MACOS_RELEASE_SIGNING_SECRET_NAMES).toEqual([
      "CSC_LINK",
      "CSC_KEY_PASSWORD",
      "APPLE_ID",
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_TEAM_ID",
    ]);
  });

  it("reports ready when every required secret is present", () => {
    expect(
      resolveMacOsReleaseSigning({
        CSC_LINK: "encoded-p12",
        CSC_KEY_PASSWORD: "export-password",
        APPLE_ID: "release@example.com",
        APPLE_APP_SPECIFIC_PASSWORD: "abcd-efgh-ijkl-mnop",
        APPLE_TEAM_ID: "TEAM123456",
      }),
    ).toEqual({
      ready: true,
      missing: [],
    });
  });

  it("treats whitespace-only values as missing", () => {
    expect(
      resolveMacOsReleaseSigning({
        CSC_LINK: "encoded-p12",
        CSC_KEY_PASSWORD: "   ",
        APPLE_ID: "release@example.com",
        APPLE_APP_SPECIFIC_PASSWORD: "abcd-efgh-ijkl-mnop",
        APPLE_TEAM_ID: "TEAM123456",
      }),
    ).toEqual({
      ready: false,
      missing: ["CSC_KEY_PASSWORD"],
    });
  });

  it("lists every missing secret without echoing secret values", () => {
    const result = resolveMacOsReleaseSigning({
      CSC_LINK: "encoded-p12",
    });

    expect(result.ready).toBe(false);
    expect(result.missing).toEqual([
      "CSC_KEY_PASSWORD",
      "APPLE_ID",
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_TEAM_ID",
    ]);
    expect(JSON.stringify(result)).not.toContain("encoded-p12");
  });
});
