export const RELAY_DEPLOY_VARIABLE_NAMES = [
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
] as const;

export const RELAY_DEPLOY_SECRET_NAMES = [
  "CLOUDFLARE_API_TOKEN",
  "PLANETSCALE_API_TOKEN_ID",
  "PLANETSCALE_API_TOKEN",
  "AXIOM_TOKEN",
  "CLERK_SECRET_KEY",
  "APNS_PRIVATE_KEY",
] as const;

export const RELAY_DEPLOY_SMOKE_VARIABLE_NAMES = ["CLERK_SMOKE_USER_ID"] as const;

export type RelayDeployVariableName = (typeof RELAY_DEPLOY_VARIABLE_NAMES)[number];
export type RelayDeploySecretName = (typeof RELAY_DEPLOY_SECRET_NAMES)[number];
export type RelayDeploySmokeVariableName = (typeof RELAY_DEPLOY_SMOKE_VARIABLE_NAMES)[number];

export interface RelayDeployConfigStatus {
  readonly missingVariables: ReadonlyArray<string>;
  readonly missingSecrets: ReadonlyArray<string>;
  readonly ready: boolean;
}

function missingNames(
  names: ReadonlyArray<string>,
  source: Readonly<Record<string, string | undefined>>,
): ReadonlyArray<string> {
  return names.filter((name) => !source[name]?.trim());
}

export function resolveRelayDeployConfig(
  variables: Readonly<Record<string, string | undefined>>,
  secrets: Readonly<Record<string, string | undefined>>,
): RelayDeployConfigStatus {
  const missingVariables = missingNames([...RELAY_DEPLOY_VARIABLE_NAMES], variables);
  const missingSecrets = missingNames([...RELAY_DEPLOY_SECRET_NAMES], secrets);
  return {
    missingVariables,
    missingSecrets,
    ready: missingVariables.length === 0 && missingSecrets.length === 0,
  };
}

export function resolveRelayDeploySmokeConfig(
  variables: Readonly<Record<string, string | undefined>>,
): ReadonlyArray<string> {
  return missingNames([...RELAY_DEPLOY_SMOKE_VARIABLE_NAMES], variables);
}
