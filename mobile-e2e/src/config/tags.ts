/**
 * Maestro flow tags for local mobile E2E filtering.
 *
 * These map 1:1 to `tags:` entries in the Maestro YAML flows and are passed to
 * `maestro test --include-tags <tag>` (without the leading `@`, which Maestro
 * strips). Keep this list in sync with the flows under `mobile-e2e/maestro/`.
 */
export const MOBILE_E2E_TAGS = {
  smoke: "@smoke",
  pairing: "@pairing",
  auth: "@auth",
  agent: "@agent",
} as const;

export type MobileE2ETag = (typeof MOBILE_E2E_TAGS)[keyof typeof MOBILE_E2E_TAGS];

/** Strip the leading `@` for Maestro's `--include-tags`, which expects bare names. */
export function toMaestroTag(tag: string): string {
  return tag.startsWith("@") ? tag.slice(1) : tag;
}
