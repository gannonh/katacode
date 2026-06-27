import { expect, type Page } from "@playwright/test";

import { E2E_TIMEOUTS } from "../config/timeouts.ts";
import {
  formatMissingPrerequisiteError,
  readAgentProviderConfig,
  readAgentProviderPrerequisites,
} from "../harness/env.ts";
import { dismissBlockingToasts } from "./navigation.ts";

export interface DeterministicAgentTurn {
  readonly provider: string;
  readonly model: string;
  readonly prompt: string;
  readonly expected: string;
}

export function assertAgentProviderConfigured(phase: string): {
  readonly provider: string;
  readonly model: string;
} {
  const prerequisites = readAgentProviderPrerequisites();
  if (!prerequisites.ok) {
    throw new Error(formatMissingPrerequisiteError(phase, prerequisites.missing));
  }

  return readAgentProviderConfig();
}

export function buildDeterministicAgentTurn(
  provider: string,
  model: string,
): DeterministicAgentTurn {
  const runId = crypto.randomUUID().slice(0, 8);
  const expected = `E2E_AGENT_OK_${runId}`;
  const prompt = `Reply to this message with exactly: ${expected}`;

  return { provider, model, prompt, expected };
}

export function assertAgentPrerequisites(phase: string): DeterministicAgentTurn {
  const { provider, model } = assertAgentProviderConfigured(phase);
  return buildDeterministicAgentTurn(provider, model);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function modelSlugToPickerPattern(modelSlug: string): RegExp {
  const tokenAssertions = modelSlug
    .split(/[-./_\s]+/u)
    .filter((segment) => segment.length > 0)
    .map((segment) => `(?=.*${escapeRegex(segment)})`)
    .join("");
  return new RegExp(tokenAssertions, "i");
}

function modelSlugToSearchQuery(modelSlug: string): string {
  return modelSlug.replace(/[-./_]+/gu, " ");
}

async function selectVisibleModelOption(page: Page, modelSlug: string): Promise<void> {
  await page.getByPlaceholder("Search models...").fill(modelSlugToSearchQuery(modelSlug));

  const modelOption = page
    .getByRole("option", { name: modelSlugToPickerPattern(modelSlug) })
    .first();
  await modelOption.waitFor({ state: "visible", timeout: E2E_TIMEOUTS.assertionMs });
  await modelOption.click();
}

async function openComposerModelPicker(page: Page) {
  await dismissBlockingToasts(page);
  await page
    .getByTestId("composer-editor")
    .waitFor({ state: "visible", timeout: E2E_TIMEOUTS.assertionMs });

  const modelPicker = page.locator('[data-chat-provider-model-picker="true"]');
  await modelPicker.click();

  const modelList = page.locator(".model-picker-list");
  await modelList.waitFor({ state: "visible", timeout: E2E_TIMEOUTS.assertionMs });
  return modelList;
}

export async function selectComposerModel(page: Page, modelSlug: string): Promise<void> {
  const modelList = await openComposerModelPicker(page);
  await selectVisibleModelOption(page, modelSlug);
  await modelList
    .waitFor({ state: "hidden", timeout: E2E_TIMEOUTS.assertionMs })
    .catch(() => undefined);
}

export async function selectComposerModelForProvider(
  page: Page,
  providerLabel: string,
  modelSlug: string,
): Promise<void> {
  const modelList = await openComposerModelPicker(page);
  await page
    .locator('[data-model-picker-sidebar="true"]')
    .getByRole("button", { name: providerLabel, exact: true })
    .click();
  await selectVisibleModelOption(page, modelSlug);
  await modelList
    .waitFor({ state: "hidden", timeout: E2E_TIMEOUTS.assertionMs })
    .catch(() => undefined);
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

export type RuntimeModeOption = "Supervised" | "Auto-accept edits" | "Full access";

/** Select a runtime mode in the composer (AC 9). The combobox exposes
 *  `Supervised` (approval-required), `Auto-accept edits`, and `Full access`. */
export async function selectRuntimeMode(page: Page, label: RuntimeModeOption): Promise<void> {
  await dismissBlockingToasts(page);
  await page.getByRole("combobox", { name: "Runtime mode" }).click();
  await page.getByRole("option", { name: label, exact: false }).click();
}

/** Click the composer Stop generation button to interrupt an in-flight turn
 *  (AC 5). Resolves once the Send button is visible again. */
export async function interruptAgentTurn(page: Page): Promise<void> {
  const stopButton = page.getByRole("button", { name: "Stop generation" });
  await stopButton.waitFor({ state: "visible", timeout: E2E_TIMEOUTS.assertionMs });
  await stopButton.click();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible({
    timeout: E2E_TIMEOUTS.assertionMs,
  });
}

/** Assert a runtime warning with `text` surfaced in the thread timeline (AC 9).
 *  Warnings render as `data-timeline-row-kind="work"` rows whose text includes
 *  the warning message. */
export async function expectTimelineWarning(page: Page, text: string): Promise<void> {
  await expect
    .poll(
      async () => page.locator('[data-timeline-row-kind="work"]').filter({ hasText: text }).count(),
      { timeout: E2E_TIMEOUTS.agentReplyMs },
    )
    .toBeGreaterThanOrEqual(1);
}

/** Assert a tool-call work row rendered in the timeline (AC 5 tool lifecycle).
 *  Tool calls surface as `data-timeline-row-kind="work"` rows with an
 *  `aria-label` derived from the tool name + args. The work group may collapse
 *  previous tool calls, so assert the group exists and is non-empty. */
export async function expectToolCallWorkRow(page: Page): Promise<void> {
  await expect
    .poll(async () => page.locator('[data-timeline-row-kind="work"]').count(), {
      timeout: E2E_TIMEOUTS.agentReplyMs,
    })
    .toBeGreaterThanOrEqual(1);
}
