// @effect-diagnostics nodeBuiltinImport:off - raw Docker Engine HTTP API over
// the Unix socket via Node built-ins; no dockerode npm dependency (AC-1.7 spike
// confirmed raw-socket viability).
import * as http from "node:http";
import * as Effect from "effect/Effect";

/**
 * Raw Docker Engine HTTP API client over the Unix socket. No `dockerode`.
 * Plain async-over-`Effect.tryPromise` so the driver has no Effect service/Layer
 * plumbing and stays immune to Effect service-API drift.
 *
 * @module dockerEngine
 */
export class DockerEngineError extends Error {
  readonly _tag = "DockerEngineError";
}

const DEFAULT_SOCKET = "/var/run/docker.sock";

/** Resolve the Docker socket path from `$DOCKER_HOST` (unix://…) or the default. */
export function resolveDockerSocket(env: NodeJS.ProcessEnv = process.env): string {
  const host = env.DOCKER_HOST;
  if (typeof host === "string" && host.startsWith("unix://")) return host.slice("unix://".length);
  return DEFAULT_SOCKET;
}

export interface DockerResponse {
  readonly status: number;
  readonly body: string;
}

/** Issue a Docker Engine API request over the Unix socket. */
export function dockerRequest(
  path: string,
  init: { method?: string; body?: string; socketPath?: string } = {},
): Effect.Effect<DockerResponse, DockerEngineError> {
  const socketPath = init.socketPath ?? resolveDockerSocket();
  return Effect.tryPromise({
    try: () =>
      new Promise<DockerResponse>((resolve, reject) => {
        const req = http.request(
          {
            socketPath,
            path,
            method: init.method ?? "GET",
            headers: init.body
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(init.body),
                }
              : {},
          },
          (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (c: string) => (body += c));
            res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
          },
        );
        req.on("error", (err) => reject(new DockerEngineError(err.message)));
        if (init.body) req.write(init.body);
        req.end();
      }),
    catch: (err) => (err instanceof DockerEngineError ? err : new DockerEngineError(String(err))),
  });
}
