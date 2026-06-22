import { expect, type Page } from "@playwright/test";

import { E2E_TIMEOUTS } from "../config/timeouts.ts";
import { formatMissingPrerequisiteError, readAgentProviderPrerequisites } from "../harness/env.ts";

export interface DeterministicAgentTurn {
  readonly provider: string;
  readonly model: string;
  readonly prompt: string;
  readonly expected: string;
}

export function assertAgentPrerequisites(phase: string): DeterministicAgentTurn {
  const prerequisites = readAgentProviderPrerequisites();
  if (!prerequisites.ok) {
    throw new Error(formatMissingPrerequisiteError(phase, prerequisites.missing));
  }

  const provider = process.env.KATACODE_E2E_AGENT_PROVIDER!.trim();
  const model = process.env.KATACODE_E2E_AGENT_MODEL!.trim();
  const runId = crypto.randomUUID().slice(0, 8);
  const expected = `E2E_AGENT_OK_${runId}`;
  const prompt = `Reply to this message with exactly: ${expected}`;

  return { provider, model, prompt, expected };
}

export async function sendAgentInstruction(page: Page, text: string): Promise<void> {
  const editor = page.getByTestId("composer-editor");
  await editor.click();
  await editor.fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

export async function readLatestAssistantMessage(page: Page): Promise<string> {
  const assistantMessages = page.locator('[data-message-role="assistant"] .chat-markdown');
  const count = await assistantMessages.count();
  if (count === 0) {
    return "";
  }
  return (await assistantMessages.nth(count - 1).innerText()).trim();
}

export async function expectAssistantReply(
  page: Page,
  expected: string,
  metadata: DeterministicAgentTurn,
  timeoutMs = E2E_TIMEOUTS.agentReplyMs,
): Promise<void> {
  try {
    await expect
      .poll(async () => normalizeAssistantText(await readLatestAssistantMessage(page)), {
        timeout: timeoutMs,
      })
      .toBe(normalizeAssistantText(expected));
  } catch (error) {
    const captured = await readLatestAssistantMessage(page);
    throw new Error(
      [
        "Deterministic agent assertion failed.",
        `provider=${metadata.provider}`,
        `model=${metadata.model}`,
        `prompt=${metadata.prompt}`,
        `expected=${metadata.expected}`,
        `captured=${JSON.stringify(captured)}`,
        error instanceof Error ? error.message : String(error),
      ].join("\n"),
      { cause: error },
    );
  }
}

export function normalizeAssistantText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
