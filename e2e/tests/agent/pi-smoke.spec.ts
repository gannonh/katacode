import { writeRunManifest } from "../../src/harness/artifacts.ts";
import { E2E_TAGS } from "../../src/config/tags.ts";
import { E2E_TIMEOUTS } from "../../src/config/timeouts.ts";
import {
  buildDeterministicAgentTurn,
  expectAssistantReply,
  expectTimelineWarning,
  expectToolCallWorkRow,
  interruptAgentTurn,
  selectComposerModelForProvider,
  selectRuntimeMode,
  sendAgentInstruction,
} from "../../src/flows/agentChat.ts";
import {
  configureDefaultPiProvider,
  formatPiSmokeSkipReason,
  readPiSmokeConfig,
} from "../../src/flows/piProvider.ts";
import { createOrOpenProject, createSeededWorkspace } from "../../src/flows/workspace.ts";
import { expect, test } from "../../src/harness/testFixtures.ts";

const piSmoke = readPiSmokeConfig();

test.describe(`Pi provider smoke ${E2E_TAGS.pi}`, () => {
  test.skip(!piSmoke.ok, piSmoke.ok ? undefined : formatPiSmokeSkipReason(piSmoke.missing));
  test.describe.configure({ timeout: E2E_TIMEOUTS.agentTestMs });

  test("streams a deterministic response from a configured Pi model", async ({
    authenticatedAppWindow,
    runContext,
  }) => {
    if (!piSmoke.ok) return;

    await configureDefaultPiProvider(authenticatedAppWindow, piSmoke.config);

    const turn = buildDeterministicAgentTurn("pi", piSmoke.config.model);
    const seededPath = await createSeededWorkspace(runContext, "pi-agent-smoke");
    await writeRunManifest(runContext);
    await createOrOpenProject(authenticatedAppWindow, seededPath);
    await selectComposerModelForProvider(authenticatedAppWindow, "Pi", turn.model);
    await sendAgentInstruction(authenticatedAppWindow, turn.prompt);
    await expectAssistantReply(authenticatedAppWindow, turn.expected, turn);
  });

  test("interrupts an in-flight Pi turn and returns to the composer", async ({
    authenticatedAppWindow,
    runContext,
  }) => {
    if (!piSmoke.ok) return;

    await configureDefaultPiProvider(authenticatedAppWindow, piSmoke.config);
    const turn = buildDeterministicAgentTurn("pi", piSmoke.config.model);
    const seededPath = await createSeededWorkspace(runContext, "pi-interrupt");
    await writeRunManifest(runContext);
    await createOrOpenProject(authenticatedAppWindow, seededPath);
    await selectComposerModelForProvider(authenticatedAppWindow, "Pi", turn.model);
    // A long prompt keeps the turn running long enough to interrupt.
    await sendAgentInstruction(
      authenticatedAppWindow,
      "Count from 1 to 200 slowly, one number per line, with no other text.",
    );
    await interruptAgentTurn(authenticatedAppWindow);
    // The working indicator is gone and the composer accepts a new message.
    await expect(authenticatedAppWindow.getByRole("button", { name: "Send message" })).toBeVisible({
      timeout: E2E_TIMEOUTS.assertionMs,
    });
  });

  test("renders a tool-call work row when the Pi agent reads a file", async ({
    authenticatedAppWindow,
    runContext,
  }) => {
    if (!piSmoke.ok) return;

    await configureDefaultPiProvider(authenticatedAppWindow, piSmoke.config);
    const seededPath = await createSeededWorkspace(runContext, "pi-tool-lifecycle");
    await writeRunManifest(runContext);
    await createOrOpenProject(authenticatedAppWindow, seededPath);
    await selectComposerModelForProvider(authenticatedAppWindow, "Pi", piSmoke.config.model);
    await sendAgentInstruction(
      authenticatedAppWindow,
      'Use the read tool to read package.json in the workspace root, then reply with only the exact value of the "name" field.',
    );
    await expectToolCallWorkRow(authenticatedAppWindow);
  });

  test("surfaces a runtime warning when the Pi session starts in approval-required mode", async ({
    authenticatedAppWindow,
    runContext,
  }) => {
    if (!piSmoke.ok) return;

    await configureDefaultPiProvider(authenticatedAppWindow, piSmoke.config);
    const seededPath = await createSeededWorkspace(runContext, "pi-runtime-mode");
    await writeRunManifest(runContext);
    await createOrOpenProject(authenticatedAppWindow, seededPath);
    await selectComposerModelForProvider(authenticatedAppWindow, "Pi", piSmoke.config.model);
    // Supervised == approval-required. Pi cannot enforce it, so the adapter
    // emits a runtime.warning at session start that renders in the timeline.
    await selectRuntimeMode(authenticatedAppWindow, "Supervised");
    await sendAgentInstruction(authenticatedAppWindow, "Reply with the single word: ready");
    await expectTimelineWarning(authenticatedAppWindow, "approval-required");
  });
});
