#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off - Relay bootstrap scripts load dotenv before Effect exists.

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";

const REPO_ROOT = NodePath.dirname(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)));
const RELAY_ENV_FILE = NodePath.join(REPO_ROOT, "infra/relay/.env");
const ROOT_ENV_FILE = NodePath.join(REPO_ROOT, ".env");

function loadEnvFile(path: string): Record<string, string | undefined> {
  if (!NodeFS.existsSync(path)) {
    return {};
  }
  return NodeUtil.parseEnv(NodeFS.readFileSync(path, "utf8"));
}

function upsertEnvValue(contents: string, name: string, value: string): string {
  const entry = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "mu");
  if (pattern.test(contents)) {
    return contents.replace(pattern, entry);
  }
  if (!contents || contents.endsWith("\n")) {
    return `${contents}${entry}\n`;
  }
  return `${contents}\n${entry}\n`;
}

const relayEnv = loadEnvFile(RELAY_ENV_FILE);
const relayUrl =
  relayEnv.RELAY_DOMAIN?.trim() ||
  (relayEnv.RELAY_API_ZONE_NAME?.trim()
    ? `https://relay.${relayEnv.RELAY_API_ZONE_NAME.trim()}`
    : undefined);

const mappings: ReadonlyArray<{ readonly source: string; readonly target: string }> = [
  { source: "CLERK_PUBLISHABLE_KEY", target: "KATACODE_CLERK_PUBLISHABLE_KEY" },
  { source: "CLERK_JWT_TEMPLATE", target: "KATACODE_CLERK_JWT_TEMPLATE" },
  { source: "CLERK_CLI_OAUTH_CLIENT_ID", target: "KATACODE_CLERK_CLI_OAUTH_CLIENT_ID" },
];

let contents = NodeFS.existsSync(ROOT_ENV_FILE) ? NodeFS.readFileSync(ROOT_ENV_FILE, "utf8") : "";

for (const mapping of mappings) {
  const value = relayEnv[mapping.source]?.trim();
  if (!value) {
    continue;
  }
  contents = upsertEnvValue(contents, mapping.target, value);
}

if (relayUrl) {
  contents = upsertEnvValue(contents, "KATACODE_RELAY_URL", relayUrl);
}

NodeFS.writeFileSync(ROOT_ENV_FILE, contents);
process.stdout.write(`Updated ${ROOT_ENV_FILE} from ${RELAY_ENV_FILE}.\n`);
