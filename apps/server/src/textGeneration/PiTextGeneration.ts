import * as Effect from "effect/Effect";
import { TextGenerationError } from "@kata-sh/code-contracts";

import type { TextGenerationShape } from "./TextGeneration.ts";

const unsupported = (
  operation:
    | "generateCommitMessage"
    | "generatePrContent"
    | "generateBranchName"
    | "generateThreadTitle",
): TextGenerationError =>
  new TextGenerationError({
    operation,
    detail:
      "Pi text generation is not wired in this build. Use Pi for chat sessions or select another provider for generated git text.",
  });

export const makePiTextGeneration = (): TextGenerationShape => ({
  generateCommitMessage: () => Effect.fail(unsupported("generateCommitMessage")),
  generatePrContent: () => Effect.fail(unsupported("generatePrContent")),
  generateBranchName: () => Effect.fail(unsupported("generateBranchName")),
  generateThreadTitle: () => Effect.fail(unsupported("generateThreadTitle")),
});
