import { describe, expect, it, vi } from "vitest";
import { TextRuns } from "@/plugin/operations/apply/writers/text-runs.ts";

const FLEX = { family: "Roboto Flex", style: "Regular" };

/** A text of one Roboto Flex run at these axes, recording the fonts set over its ranges. */
function build(variationSettings: Record<string, number>) {
  const set: unknown[] = [];
  const node = {
    type: "TEXT",
    characters: "Hey",
    getStyledTextSegments: () => [{ start: 0, end: 3, fontName: { ...FLEX, variationSettings } }],
    setRangeFontName: vi.fn((start: number, end: number, font: unknown) => set.push([start, end, font])),
  };
  const runs = new TextRuns({} as never, {} as never, {} as never, {} as never);

  return { runs, node, set };
}

describe("TextRuns axes", () => {
  // CSS's font-variation-settings: the axes named, the weight and optical size the font says, every other axis the
  // font's own (a browser default where CSS has one).
  it("sets the axes named over each run's font, and returns the rest to the font's own", async () => {
    const { runs, node, set } = build({ wght: 560, opsz: 16, wdth: 90, GRAD: 50 });

    await runs.write("fontVariations", { node: node as never, start: 0, end: 3 }, { fontVariations: { GRAD: -20 } });
    await runs.write("fontVariations", { node: node as never, start: 0, end: 3 }, { fontVariations: {} });

    expect(set).toEqual([
      [0, 3, { ...FLEX, variationSettings: { wght: 560, opsz: 16, wdth: 100, GRAD: -20 } }],
      [0, 3, { ...FLEX, variationSettings: { wght: 560, opsz: 16, wdth: 100 } }],
    ]);
  });
});
