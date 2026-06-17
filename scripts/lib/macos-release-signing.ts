export const MACOS_RELEASE_SIGNING_SECRET_NAMES = [
  "CSC_LINK",
  "CSC_KEY_PASSWORD",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
] as const;

export type MacOsReleaseSigningSecretName = (typeof MACOS_RELEASE_SIGNING_SECRET_NAMES)[number];

export interface MacOsReleaseSigningInput {
  readonly CSC_LINK?: string | undefined;
  readonly CSC_KEY_PASSWORD?: string | undefined;
  readonly APPLE_ID?: string | undefined;
  readonly APPLE_APP_SPECIFIC_PASSWORD?: string | undefined;
  readonly APPLE_TEAM_ID?: string | undefined;
}

export interface MacOsReleaseSigningStatus {
  readonly ready: boolean;
  readonly missing: readonly MacOsReleaseSigningSecretName[];
}

export function resolveMacOsReleaseSigning(
  input: MacOsReleaseSigningInput,
): MacOsReleaseSigningStatus {
  const missing = MACOS_RELEASE_SIGNING_SECRET_NAMES.filter((name) => !input[name]?.trim());

  return {
    ready: missing.length === 0,
    missing,
  };
}
