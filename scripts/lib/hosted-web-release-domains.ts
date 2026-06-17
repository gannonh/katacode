import {
  DEFAULT_HOSTED_APP_ORIGIN,
  HOSTED_WEB_LATEST_ORIGIN,
  HOSTED_WEB_NIGHTLY_ORIGIN,
  HOSTED_WEB_ROUTER_HOST,
} from "@kata-sh/code-shared/branding";

export interface HostedWebReleaseDomainInput {
  readonly routerUrl?: string | undefined;
  readonly latestDomain?: string | undefined;
  readonly nightlyDomain?: string | undefined;
}

export interface HostedWebReleaseDomains {
  readonly routerUrl: string;
  readonly latestDomain: string;
  readonly nightlyDomain: string;
  readonly routerDomain: string;
}

function parseRouterDomain(routerUrl: string): string {
  const withoutProtocol = routerUrl.replace(/^https?:\/\//u, "");
  return withoutProtocol.split("/")[0] ?? HOSTED_WEB_ROUTER_HOST;
}

export function resolveHostedWebReleaseDomains(
  input: HostedWebReleaseDomainInput = {},
): HostedWebReleaseDomains {
  const routerUrl = input.routerUrl?.trim() || DEFAULT_HOSTED_APP_ORIGIN;
  const latestDomain =
    input.latestDomain?.trim() || HOSTED_WEB_LATEST_ORIGIN.replace(/^https?:\/\//u, "");
  const nightlyDomain =
    input.nightlyDomain?.trim() || HOSTED_WEB_NIGHTLY_ORIGIN.replace(/^https?:\/\//u, "");

  return {
    routerUrl,
    latestDomain,
    nightlyDomain,
    routerDomain: parseRouterDomain(routerUrl),
  };
}
