import { createServer } from "node:net";

export const BASE_SERVER_PORT = 13773;
export const BASE_WEB_PORT = 5733;
const MAX_PORT = 65_535;

export function portPairForOffset(offset: number): {
  readonly serverPort: number;
  readonly webPort: number;
} {
  return {
    serverPort: BASE_SERVER_PORT + offset,
    webPort: BASE_WEB_PORT + offset,
  };
}

async function canListen(port: number, host: string): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function isPortAvailable(port: number): Promise<boolean> {
  const hosts = ["127.0.0.1", "::1"] as const;
  for (const host of hosts) {
    if (!(await canListen(port, host))) {
      return false;
    }
  }
  return true;
}

export async function findAvailablePortOffset(
  startOffset: number,
): Promise<{ readonly offset: number; readonly serverPort: number; readonly webPort: number }> {
  for (let offset = startOffset; offset < 10_000; offset += 1) {
    const { serverPort, webPort } = portPairForOffset(offset);
    if (serverPort > MAX_PORT || webPort > MAX_PORT) {
      break;
    }

    if ((await isPortAvailable(serverPort)) && (await isPortAvailable(webPort))) {
      return { offset, serverPort, webPort };
    }
  }

  throw new Error(
    `E2E port allocation failed while probing from offset ${startOffset}. Free local ports near ${BASE_SERVER_PORT}/${BASE_WEB_PORT} or set KATACODE_PORT_OFFSET.`,
  );
}
