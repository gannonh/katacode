/**
 * Web E2E fixture — starts the dev server, captures the pairing URL from
 * startup output, and provides an authenticated page for web tests.
 *
 * The server is started as a child process so we can capture the
 * `pairingUrl` line from stdout. The process is killed when the fixture
 * scope ends.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { type Page, test as base } from "@playwright/test";

const WEB_URL = process.env["KATACODE_WEB_URL"] ?? "http://localhost:5733";
const PAIRING_URL_TIMEOUT_MS = 60_000;

interface WebFixture {
  pairingUrl: string;
  webUrl: string;
}

function resolveRepoRoot(): string {
  return join(dirname(new URL(import.meta.url).pathname), "..", "..", "..");
}

/**
 * Start `pnpm run dev` and capture the pairing URL from stdout.
 * If the server is already running and has an active session (cookie
 * from a prior run), the pairing URL may not appear — in that case
 * we return the base web URL and let the test proceed without pairing.
 */
async function startDevServerAndCapturePairingUrl(): Promise<{
  pairingUrl: string | null;
  process: ChildProcess | null;
}> {
  const repoRoot = resolveRepoRoot();

  // Check if a server is already running on the web port.
  const alreadyRunning = await fetch(`${WEB_URL}/`, { method: "GET" })
    .then((res) => res.ok)
    .catch(() => false);

  if (alreadyRunning) {
    return { pairingUrl: null, process: null };
  }

  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["run", "dev"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        KATACODE_NO_BROWSER: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let pairingUrl: string | null = null;
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill();
        reject(new Error("Timed out waiting for dev server pairing URL."));
      }
    }, PAIRING_URL_TIMEOUT_MS);

    const onLine = (line: string) => {
      if (pairingUrl) return;
      const match = line.match(/pairingUrl:\s*(\S+)/);
      if (match) {
        pairingUrl = match[1];
        clearTimeout(timeout);
        resolved = true;
        resolve({ pairingUrl, process: child });
      }
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      for (const line of chunk.split("\n")) onLine(line);
    });
    child.stderr?.on("data", (chunk: string) => {
      for (const line of chunk.split("\n")) onLine(line);
    });

    child.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

/**
 * Authenticate a Playwright page by navigating to the pairing URL.
 * The app auto-submits the token from the URL hash and redirects to "/".
 * If no pairing URL is available (server already running with an existing
 * session), just navigate to "/" and hope for the best.
 */
async function authenticatePage(page: Page, pairingUrl: string | null): Promise<void> {
  if (pairingUrl) {
    await page.goto(pairingUrl);
    // The app auto-submits the token and redirects to "/".
    await page.waitForURL("/", { timeout: 30_000 });
  } else {
    await page.goto("/");
  }

  // Wait for the app shell to render (authenticated state).
  await page.getByTestId("command-palette-trigger").waitFor({ state: "visible", timeout: 30_000 });
}

export const webTest = base.extend<{
  webPage: Page;
  webFixture: WebFixture;
}>({
  webFixture: async ({}, use) => {
    const { pairingUrl, process: serverProcess } = await startDevServerAndCapturePairingUrl();

    try {
      await use({ pairingUrl: pairingUrl ?? "", webUrl: WEB_URL });
    } finally {
      if (serverProcess) {
        serverProcess.kill("SIGTERM");
        serverProcess.kill("SIGKILL");
      }
    }
  },
  webPage: async ({ page, webFixture }, use) => {
    await authenticatePage(page, webFixture.pairingUrl || null);
    await use(page);
  },
});

export { expect } from "@playwright/test";
