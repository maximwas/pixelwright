import { describe, expect, it, vi } from "vitest";
import { ApplyFonts } from "@/plugin/operations/apply/apply-fonts.ts";

const BOLD = { family: "Inter", style: "Bold" };
const BROKEN = { family: "Broken", style: "Regular" };

/** A text there in Broken Regular, and a call that retypes it, makes a new Text and asks for Inter 700. */
function build() {
  const loaded: string[] = [];
  const factory = {
    textFonts: () => [BROKEN],
    loadFont: vi.fn(async (font: FontName) => {
      if (font.family === BROKEN.family) {
        throw new Error("no font");
      }

      loaded.push(`${font.family} ${font.style}`);
    }),
  };
  const fonts = new ApplyFonts(
    { start: () => undefined, fontName: async () => BOLD } as never,
    factory as never,
    { node: async () => ({ type: "TEXT", characters: "Hi", getStyledTextSegments: () => [] }) } as never,
    { style: async () => null } as never,
  );
  const font = { family: "Inter", weight: 700, italic: false, size: 16, lineHeight: { unit: "AUTO" } };
  const changes = [
    { kind: "update", id: "1:2", tag: "Text", props: {}, text: { characters: "New", runs: [] } },
    { kind: "create", id: null, tag: "Text", props: { font }, text: { characters: "Made", runs: [] } },
  ];

  return { fonts, factory, loaded, changes, font };
}

describe("ApplyFonts", () => {
  // P-148, FX-040: every changed text's fonts and the ones asked for load first; a new text starts in Inter Regular.
  it("loads the fonts of a real call up front and remembers the one that failed", async () => {
    const { fonts, loaded, changes, font } = build();

    await fonts.start(changes as never, false);

    expect(loaded.sort()).toEqual(["Inter Bold", "Inter Regular"]);
    expect(fonts.font(font as never)).toEqual(BOLD);
    expect(fonts.unloadedIn({} as never)).toEqual(BROKEN);
  });

  it("finds the fonts on a dry run and loads none", async () => {
    const { fonts, factory, changes, font } = build();

    await fonts.start(changes as never, true);

    expect(fonts.font(font as never)).toEqual(BOLD);
    expect(factory.loadFont).not.toHaveBeenCalled();
  });
});
