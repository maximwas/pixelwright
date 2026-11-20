import { describe, expect, it } from "vitest";
import { OutermostLayers } from "@/plugin/operations/read/outermost-layers.ts";

describe("OutermostLayers", () => {
  // P-118: the apply profile reads the outermost named layers; a nested one is inside what is read.
  it("keeps the named layers no other named layer holds, in the order asked", () => {
    const above: Record<string, string[]> = { "1:3": ["1:2", "1:1"], "1:2": ["1:1"], "1:1": [], "5:5": ["5:1"] };
    const kept = new OutermostLayers().of(["1:3", "5:5", "1:1", "1:2"], (id) => above[id] ?? []);

    expect(kept).toEqual(["5:5", "1:1"]);
  });
});
