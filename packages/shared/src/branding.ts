export const APP_BASE_NAME = "KataCode" as const;

export const formatAppDisplayName = (stageLabel: string): string =>
  `${APP_BASE_NAME} (${stageLabel})`;
