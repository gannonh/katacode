export const APP_BASE_NAME = "KataCode" as const;

export const CLOUD_PRODUCT_NAME = "KataCode Connect" as const;

/** Default user state directory under the home folder (`~/.katacode`). */
export const DEFAULT_HOME_DIR_NAME = ".katacode" as const;

/** Environment variable prefix for runtime configuration (`KATACODE_*`). */
export const ENV_PREFIX = "KATACODE_" as const;

/** Git branch namespace for product-generated refs (worktrees, PR branches). */
export const WORKTREE_BRANCH_PREFIX = "katacode" as const;

const NIGHTLY_VERSION_PATTERN = /-nightly\.\d{8}\.\d+$/u;

const UPSTREAM_APP_BASE_NAME = "T3 Code" as const;

export type AppStageLabel = "Dev" | "Alpha" | "Nightly" | "Latest";

export interface AppBranding {
  readonly baseName: typeof APP_BASE_NAME;
  readonly stageLabel: AppStageLabel;
  readonly displayName: string;
}

export const envKey = (suffix: string): string => `${ENV_PREFIX}${suffix}`;

export const resolveDefaultKatacodeHome = (homeDirectory: string): string =>
  `${homeDirectory.replace(/[/\\]+$/, "")}/${DEFAULT_HOME_DIR_NAME}`;

export const isNightlyAppVersion = (version: string): boolean =>
  NIGHTLY_VERSION_PATTERN.test(version.trim());

export const formatAppDisplayName = (stageLabel: string): string =>
  `${APP_BASE_NAME} (${stageLabel})`;

export const formatUpstreamAppDisplayName = (stageLabel: AppStageLabel): string =>
  `${UPSTREAM_APP_BASE_NAME} (${stageLabel})`;

export function resolveAppStageLabel(input: {
  readonly isDevelopment: boolean;
  readonly appVersion: string;
  readonly hostedAppChannel?: "latest" | "nightly" | null;
}): AppStageLabel {
  if (input.hostedAppChannel === "nightly") {
    return "Nightly";
  }
  if (input.hostedAppChannel === "latest") {
    return "Latest";
  }
  if (input.isDevelopment) {
    return "Dev";
  }
  return isNightlyAppVersion(input.appVersion) ? "Nightly" : "Alpha";
}

export function resolveAppBranding(input: {
  readonly isDevelopment: boolean;
  readonly appVersion: string;
  readonly hostedAppChannel?: "latest" | "nightly" | null;
}): AppBranding {
  const stageLabel = resolveAppStageLabel(input);
  return {
    baseName: APP_BASE_NAME,
    stageLabel,
    displayName: formatAppDisplayName(stageLabel),
  };
}

/** Legacy Electron userData folder names to probe when migrating from upstream T3 Code. */
export function resolveLegacyUserDataDirNames(input: {
  readonly isDevelopment: boolean;
  readonly appVersion: string;
}): readonly string[] {
  const stageLabel = resolveAppStageLabel({
    isDevelopment: input.isDevelopment,
    appVersion: input.appVersion,
  });
  const upstreamStageLabel = stageLabel;
  return [formatAppDisplayName(stageLabel), formatUpstreamAppDisplayName(upstreamStageLabel)];
}
