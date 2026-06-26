import type { Page } from "@playwright/test";

export interface PiSmokeConfig {
  readonly agentDir: string;
  readonly model: string;
}

const REQUIRED_PI_ENV = [
  "KATACODE_E2E_ENABLE_PI",
  "KATACODE_E2E_PI_AGENT_DIR",
  "KATACODE_E2E_PI_MODEL",
] as const;

export function readPiSmokeConfig():
  | { readonly ok: true; readonly config: PiSmokeConfig }
  | { readonly ok: false; readonly missing: ReadonlyArray<(typeof REQUIRED_PI_ENV)[number]> } {
  const missing = REQUIRED_PI_ENV.filter((name) => {
    const value = process.env[name];
    if (name === "KATACODE_E2E_ENABLE_PI") return value !== "1";
    return value === undefined || value.trim().length === 0;
  });

  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    config: {
      agentDir: process.env.KATACODE_E2E_PI_AGENT_DIR!,
      model: process.env.KATACODE_E2E_PI_MODEL!,
    },
  };
}

export function formatPiSmokeSkipReason(missing: ReadonlyArray<string>): string {
  return `Pi E2E smoke skipped. Missing or disabled: ${missing.join(", ")}.`;
}

export async function configureDefaultPiProvider(page: Page, config: PiSmokeConfig): Promise<void> {
  await page.evaluate(async (input) => {
    const nativeApi = window.nativeApi;
    if (!nativeApi) {
      throw new Error("Native API is unavailable; cannot configure Pi provider for E2E.");
    }

    const settings = await nativeApi.server.getSettings();
    await nativeApi.server.updateSettings({
      providers: {
        ...settings.providers,
        pi: {
          ...settings.providers.pi,
          enabled: true,
          agentDir: input.agentDir,
          customModels: [input.model],
        },
      },
    });
  }, config);
}
