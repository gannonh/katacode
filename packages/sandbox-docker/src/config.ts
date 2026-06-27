/**
 * Config schema for the Docker sandbox driver. Owned by the driver (the contract
 * layer keeps `config: Schema.Unknown`). Rendered in Settings via
 * `ProviderSettingsForm` using the `providerSettingsForm` annotations.
 *
 * @module config
 */
import * as Schema from "effect/Schema";

import { makeProviderSettingsSchema } from "@kata-sh/code-contracts/settings";

export const DockerSandboxConfig = makeProviderSettingsSchema({
  image: Schema.String.pipe(
    Schema.annotateKey({
      title: "Image",
      description: "Container image (must contain your start command's runtime).",
      providerSettingsForm: { placeholder: "node:22-alpine", clearWhenEmpty: "omit" },
    }),
  ),
  command: Schema.String.pipe(
    Schema.annotateKey({
      title: "Start command",
      description:
        "Command to launch the Kata server inside the container, e.g. `katacode serve --port 13773`.",
      providerSettingsForm: { placeholder: "katacode serve --port 13773", clearWhenEmpty: "omit" },
    }),
  ),
  port: Schema.Number.pipe(
    Schema.annotateKey({
      title: "Container port",
      description: "In-container port the Kata server listens on.",
      providerSettingsForm: { placeholder: "13773" },
    }),
  ),
  extraEnv: Schema.optionalKey(
    Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.String })),
  ),
});

export type DockerSandboxConfig = typeof DockerSandboxConfig.Type;

export const DEFAULT_DOCKER_CONFIG: DockerSandboxConfig = {
  image: "node:22-alpine",
  command:
    "node -e \"require('http').createServer((q,s)=>{s.end('katacode-serve-stub')}).listen(13773)\"",
  port: 13773,
};
