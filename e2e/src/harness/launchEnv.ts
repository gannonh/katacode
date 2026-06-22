import type { E2ERunContext } from "./isolatedRun.ts";

const DEV_ONLY_ENV_KEYS = ["VITE_DEV_SERVER_URL", "PORT", "VITE_HTTP_URL", "VITE_WS_URL"] as const;

export function resolveRendererPort(context: E2ERunContext): number {
  return context.launchTarget === "release" ? context.serverPort : context.webPort;
}

export function resolveRendererPortLabel(context: E2ERunContext): string {
  return context.launchTarget === "release" ? "embedded server" : "Vite";
}

export function buildElectronLaunchEnv(context: E2ERunContext): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...context.devEnv,
    KATACODE_PORT: String(context.serverPort),
    ELECTRON_ENABLE_LOGGING: "1",
  };
  delete env.ELECTRON_RUN_AS_NODE;

  if (context.launchTarget === "release") {
    for (const key of DEV_ONLY_ENV_KEYS) {
      delete env[key];
    }
    return env;
  }

  return {
    ...env,
    PORT: String(context.webPort),
    VITE_DEV_SERVER_URL: `http://127.0.0.1:${context.webPort}`,
    VITE_HTTP_URL: `http://127.0.0.1:${context.serverPort}`,
    VITE_WS_URL: `ws://127.0.0.1:${context.serverPort}`,
  };
}

export function isRendererWindow(url: string, rendererPort: number): boolean {
  if (!url || url === "about:blank" || url.startsWith("devtools://")) {
    return false;
  }

  return url.includes(`127.0.0.1:${rendererPort}`) || url.includes(`localhost:${rendererPort}`);
}
