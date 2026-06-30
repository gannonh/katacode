import type { ServerProviderSkill } from "@kata-sh/code-contracts";

const PROVIDER_SKILL_TOKEN_PREFIX = "skill";

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function providerSkillPathHash(path: string): string {
  return fnv1a32(path);
}

export function makeProviderSkillInvocationToken(
  skill: Pick<ServerProviderSkill, "name" | "path">,
): string {
  return `${PROVIDER_SKILL_TOKEN_PREFIX}:${skill.name}:${providerSkillPathHash(skill.path)}`;
}

export function isPathQualifiedProviderSkillToken(token: string): boolean {
  return token.startsWith(`${PROVIDER_SKILL_TOKEN_PREFIX}:`) && token.split(":").length === 3;
}
