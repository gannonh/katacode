import { describe, expect, it } from "vitest";

import { TimeoutError, withTimeout } from "./withTimeout.ts";

describe("withTimeout", () => {
  it("resolves when the operation finishes in time", async () => {
    await expect(withTimeout("fast op", 1_000, async () => "ok")).resolves.toBe("ok");
  });

  it("rejects with a labeled timeout error", async () => {
    await expect(
      withTimeout("slow op", 25, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "late";
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
