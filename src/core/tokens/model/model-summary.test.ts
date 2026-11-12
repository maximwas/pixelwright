import { describe, expect, it } from "vitest";
import type { Tokens } from "@/core/tokens/model/model.schema.ts";
import { ModelSummary } from "@/core/tokens/model/model-summary.ts";

const variable = (name: string) => ({
  id: `V:${name}`,
  name,
  token: `--${name}`,
  type: "FLOAT",
  values: { Base: "8px" },
});

const style = (name: string) => ({ name, token: `--${name}`, value: "#000" });

const collection = (name: string, variables: ReturnType<typeof variable>[]) => ({
  name,
  modes: ["Base"],
  defaultMode: "Base",
  selectors: {},
  variables,
});

const TOKENS: Tokens = {
  collections: [
    collection("Spacing", [variable("space-8"), variable("space-16")]),
    collection("Radius", [variable("radius-sm")]),
  ],
  styles: { paint: [style("Ink")], text: [], effect: [style("Shadow")] },
};

const size = (tokens: Tokens) => JSON.stringify(tokens).length;

const summary = new ModelSummary();

describe("ModelSummary", () => {
  it("counts the model and keeps the most whole tokens that fit, in order, a collection past the cut left out (T-161)", () => {
    const three: Tokens = {
      collections: [
        collection("Spacing", [variable("space-8"), variable("space-16")]),
        collection("Radius", [variable("radius-sm")]),
      ],
      styles: { paint: [], text: [], effect: [] },
    };
    const two: Tokens = { ...three, collections: [collection("Spacing", [variable("space-8"), variable("space-16")])] };

    expect(summary.count(TOKENS)).toEqual({
      collections: [
        { name: "Spacing", modes: ["Base"], variables: 2 },
        { name: "Radius", modes: ["Base"], variables: 1 },
      ],
      styles: { paint: 1, text: 0, effect: 1 },
    });
    expect(summary.first(TOKENS, size(three) + 1, size)).toEqual({ tokens: three, shown: 3, total: 5 });
    expect(summary.first(TOKENS, size(three) - 1, size)).toEqual({ tokens: two, shown: 2, total: 5 });
  });

  it("keeps no token when not even one fits, never a part of one (T-161)", () => {
    expect(summary.first(TOKENS, 10, size)).toEqual({
      tokens: { collections: [], styles: { paint: [], text: [], effect: [] } },
      shown: 0,
      total: 5,
    });
  });
});
