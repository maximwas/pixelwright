import { expect, it } from "vitest";
import { LIMITS } from "../../src/shared/limits/limits.constants.ts";

// Every shared limit with its value (P-155+r). A deliberate change updates __golden__/limits.json in the same commit,
// with the reason.
it("keeps every shared limit", async () => {
  await expect(`${JSON.stringify(LIMITS, null, 2)}\n`).toMatchFileSnapshot("__golden__/limits.json");
});
