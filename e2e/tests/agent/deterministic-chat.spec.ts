import { writeRunManifest } from "../../src/harness/artifacts.ts";
import { E2E_TAGS } from "../../src/config/tags.ts";
import { E2E_TIMEOUTS } from "../../src/config/timeouts.ts";
import {
  assertAgentPrerequisites,
  expectAssistantReply,
  sendAgentInstruction,
} from "../../src/assertions/agentAssertions.ts";
import { expectSignedInClerkState, signInWithClerkGoogleTestUser } from "../../src/flows/auth.ts";
import { createOrOpenProject, createSeededWorkspace } from "../../src/flows/workspace.ts";
import { test } from "../../src/harness/testFixtures.ts";

test.describe(`Deterministic agent chat ${E2E_TAGS.agent}`, () => {
  test.describe.configure({ timeout: E2E_TIMEOUTS.agentTestMs });

  test("returns the exact expected assistant message from a real provider", async ({
    appWindow,
    runContext,
  }) => {
    const turn = assertAgentPrerequisites("deterministic agent chat");
    await signInWithClerkGoogleTestUser(appWindow);
    await expectSignedInClerkState(appWindow);

    const seededPath = await createSeededWorkspace(runContext, "agent-chat-basic");
    await writeRunManifest(runContext);
    await createOrOpenProject(appWindow, seededPath);

    await sendAgentInstruction(appWindow, turn.prompt);
    await expectAssistantReply(appWindow, turn.expected, turn);
  });
});
