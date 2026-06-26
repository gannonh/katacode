import { writeRunManifest } from "../../src/harness/artifacts.ts";
import { E2E_TAGS } from "../../src/config/tags.ts";
import { E2E_TIMEOUTS } from "../../src/config/timeouts.ts";
import {
  buildDeterministicAgentTurn,
  expectAssistantReply,
  selectComposerModelForProvider,
  sendAgentInstruction,
} from "../../src/flows/agentChat.ts";
import {
  configureDefaultPiProvider,
  formatPiSmokeSkipReason,
  readPiSmokeConfig,
} from "../../src/flows/piProvider.ts";
import { createOrOpenProject, createSeededWorkspace } from "../../src/flows/workspace.ts";
import { test } from "../../src/harness/testFixtures.ts";

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
});
