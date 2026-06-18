#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off - Relay bootstrap scripts load dotenv before Effect exists.

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";

import { resolveRelayDeployConfig, resolveRelayDeploySmokeConfig } from "./deploy-config.ts";
import { runCredentialSmoke } from "./credential-smoke.ts";

const RELAY_ROOT = NodePath.dirname(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)));
const ENV_FILE = NodePath.join(RELAY_ROOT, ".env");

function loadRelayEnvFile(path: string): Record<string, string | undefined> {
  if (!NodeFS.existsSync(path)) {
    return {};
  }
  return NodeUtil.parseEnv(NodeFS.readFileSync(path, "utf8"));
}

const env = {
  ...loadRelayEnvFile(ENV_FILE),
  ...process.env,
};

const configStatus = resolveRelayDeployConfig(
  Object.fromEntries(
    [
      "CLOUDFLARE_ACCOUNT_ID",
      "PLANETSCALE_ORGANIZATION",
      "AXIOM_ORG_ID",
      "RELAY_API_ZONE_NAME",
      "RELAY_TUNNEL_ZONE_NAME",
      "CLERK_PUBLISHABLE_KEY",
      "CLERK_JWT_AUDIENCE",
      "CLERK_JWT_TEMPLATE",
      "CLERK_CLI_OAUTH_CLIENT_ID",
      "APNS_ENVIRONMENT",
      "APNS_TEAM_ID",
      "APNS_KEY_ID",
      "APNS_BUNDLE_ID",
    ].map((name) => [name, env[name]]),
  ),
  Object.fromEntries(
    [
      "CLOUDFLARE_API_TOKEN",
      "PLANETSCALE_API_TOKEN_ID",
      "PLANETSCALE_API_TOKEN",
      "AXIOM_TOKEN",
      "CLERK_SECRET_KEY",
      "APNS_PRIVATE_KEY",
    ].map((name) => [name, env[name]]),
  ),
);

if (!configStatus.ready) {
  process.stderr.write(
    `Missing relay deploy config in ${ENV_FILE}: ${[
      ...configStatus.missingVariables,
      ...configStatus.missingSecrets,
    ].join(", ")}\n`,
  );
  process.exit(1);
}

const missingSmoke = resolveRelayDeploySmokeConfig(env);
if (missingSmoke.length > 0) {
  process.stderr.write(`Missing relay smoke config: ${missingSmoke.join(", ")}\n`);
  process.exit(1);
}

runCredentialSmoke(env)
  .then((summary) => {
    for (const result of summary.results) {
      const line = `${result.ok ? "pass" : "fail"} ${result.name}: ${result.detail}\n`;
      if (result.ok) {
        process.stdout.write(line);
      } else {
        process.stderr.write(line);
      }
    }
    if (!summary.ok) {
      process.exit(1);
    }
    process.stdout.write("Relay credential smoke passed.\n");
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Relay credential smoke failed: ${message}\n`);
    process.exit(1);
  });
