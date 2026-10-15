import { describe, expect, it } from "vitest";
import { baselineDiff } from "../../src/diff/baseline/baseline-diff.ts";
import { editedPricing, rawTokensOf, withIconPaths } from "../helpers/baseline-edits.ts";
import { fixture } from "../helpers/fixtures.ts";

describe("golden baseline diff", () => {
  it("keeps what changed on Orbit's pricing page since its baseline, list by list", async () => {
    const before = withIconPaths(fixture("orbit-pricing"), "v1");
    const after = editedPricing(before);
    const result = baselineDiff(
      {
        snapshot: before,
        tokens: rawTokensOf(before),
      },
      {
        snapshot: after,
        tokens: rawTokensOf(after),
      },
      { sameReader: true },
    );

    await expect(`${JSON.stringify(result, null, 2)}\n`).toMatchFileSnapshot("__golden__/baseline-diff.orbit.json");
  });
});
