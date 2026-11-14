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

describe("TextRuns colour", () => {
  // FIX-090A2: the check bound a run's colour token in the text's XML modes and the write in none, so a name two
  // collections share could be bound to the other one.
  it("binds a run's colour token in the modes the text's XML sets, the text's own and a Span's alike", async () => {
    const paints = vi.fn(async (_specs: unknown, _node: unknown, _modes?: object) => []);
    const runs = new TextRuns({} as never, {} as never, { paints } as never, {} as never);
    const node = { type: "TEXT", setRangeFills: vi.fn() };
    const textFills = [{ kind: "token", token: "--primary" }];
    const modes = { "brand-b": "indigo" };

    await runs.write("textFills", { node: node as never, start: 0, end: 3 }, { textFills, modes } as never);
    await runs.write("textFills", { node: node as never, start: 0, end: 1 }, { textFills } as never, modes);

    expect(paints.mock.calls.map(([, , given]) => given)).toEqual([modes, modes]);
  });
});
