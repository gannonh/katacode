export const APP_BASE_NAME = "KataCode" as const;

export const CLOUD_PRODUCT_NAME = "KataCode Connect" as const;

/** Default user state directory under the home folder (`~/.katacode`). */
export const DEFAULT_HOME_DIR_NAME = ".katacode" as const;

/** Environment variable prefix for runtime configuration (`KATACODE_*`). */
export const ENV_PREFIX = "KATACODE_" as const;

export const formatAppDisplayName = (stageLabel: string): string =>
  `${APP_BASE_NAME} (${stageLabel})`;
