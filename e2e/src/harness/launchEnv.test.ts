import { describe, expect, it } from "vitest";

import type { E2ERunContext } from "./isolatedRun.ts";
import {
  buildElectronLaunchEnv,
  isRendererWindow,
  resolveRendererPort,
  resolveRendererPortLabel,
} from "./launchEnv.ts";

function makeContext(launchTarget: "dev" | "release"): E2ERunContext {
  return {
    runId: "e2e-test",
    projectName: launchTarget === "release" ? "desktop-release" : "desktop-dev",
    launchTarget,
    repoRoot: "/repo",
    katacodeHome: "/tmp/katacode-home",
    workspaceRoot: "/tmp/workspace",
    artifactRoot: "/tmp/artifacts",
    serverPort: 13773,
    webPort: 5733,
    devEnv: {
      KATACODE_HOME: "/tmp/katacode-home",
      VITE_DEV_SERVER_URL: "http://127.0.0.1:5173",
      PORT: "5173",
    },
    cleanupCallbacks: [],
  };
}

describe("launchEnv", () => {
  it("uses the embedded server port for release renderer detection", () => {
    const context = makeContext("release");
    expect(resolveRendererPort(context)).toBe(13773);
    expect(resolveRendererPortLabel(context)).toBe("embedded server");
  });

  it("uses the Vite port for dev renderer detection", () => {
    const context = makeContext("dev");
    expect(resolveRendererPort(context)).toBe(5733);
    expect(resolveRendererPortLabel(context)).toBe("Vite");
  });

  it("strips dev-only env vars for release launches", () => {
    const env = buildElectronLaunchEnv(makeContext("release"));

    expect(env.KATACODE_PORT).toBe("13773");
    expect(env.KATACODE_HOME).toBe("/tmp/katacode-home");
    expect(env.VITE_DEV_SERVER_URL).toBeUndefined();
    expect(env.PORT).toBeUndefined();
    expect(env.VITE_HTTP_URL).toBeUndefined();
    expect(env.VITE_WS_URL).toBeUndefined();
  });

  it("sets dev stack env vars for dev launches", () => {
    const env = buildElectronLaunchEnv(makeContext("dev"));

    expect(env.KATACODE_PORT).toBe("13773");
    expect(env.PORT).toBe("5733");
    expect(env.VITE_DEV_SERVER_URL).toBe("http://127.0.0.1:5733");
    expect(env.VITE_HTTP_URL).toBe("http://127.0.0.1:13773");
    expect(env.VITE_WS_URL).toBe("ws://127.0.0.1:13773");
  });

  it("matches renderer URLs on the configured port", () => {
    expect(isRendererWindow("http://127.0.0.1:13773/", 13773)).toBe(true);
    expect(isRendererWindow("devtools://devtools/bundled/inspector.html", 13773)).toBe(false);
    expect(isRendererWindow("about:blank", 13773)).toBe(false);
  });
});
