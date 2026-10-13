import { describe, expect, it } from "vitest";
import { checkFonts } from "../src/fonts/check-fonts.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const run = (characters: string, family: string, style: string, weight: number) => ({
  characters,
  start: 0,
  end: characters.length,
  fontName: {
    family,
    style,
  },
  fontSize: 16,
  fontWeight: weight,
  textDecoration: "NONE",
  textCase: "ORIGINAL",
  lineHeight: { unit: "AUTO" },
  letterSpacing: {
    unit: "PIXELS",
    value: 0,
  },
  fills: [],
  fillStyleId: "",
  textStyleId: "",
});

const text = (id: string, segment: ReturnType<typeof run>) => ({
  id,
  name: id,
  type: "TEXT",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  childCount: 0,
  text: {
    characters: segment.characters,
    textAutoResize: "WIDTH_AND_HEIGHT",
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    segments: [segment],
  },
});

const bridge: BridgeView = {
  status: () => {
    throw new Error("not used");
  },
  pairing: () => null,
  plugins: () => [
    {
      session: "s1",
      info: pluginInfo(),
      active: true,
    },
  ],
  request: async () => ({
    root: {
      id: "1:1",
      name: "Screen",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      childCount: 3,
      layoutMode: "VERTICAL",
      children: [
        text("1:2", run("Title", "Manrope", "SemiBold", 600)),
        text("1:3", run("Body", "Manrope", "Regular", 400)),
        text("1:4", run("Price", "Proxima Nova", "Bold", 700)),
      ],
    },
    styles: {},
    variables: {},
  }),
};

describe("fonts_check", () => {
  it("says which fonts Google Fonts serves, with a link for the weights used, and which need their own files", async () => {
    const result = await checkFonts(
      bridge,
      { node: "1:1" },
      async () => new Map([["Manrope", ["200", "400", "600", "800"]]]),
    );

    expect(result.fonts).toEqual([
      {
        family: "Manrope",
        weights: ["400", "600"],
        google: true,
        css: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&display=swap",
      },
      {
        family: "Proxima Nova",
        weights: ["700"],
        google: false,
        note: "Not on Google Fonts: the build needs its own files (a licence from its foundry, or a fallback).",
      },
    ]);
  });

  it("says so when Google Fonts cannot be reached, and still lists the fonts", async () => {
    const result = await checkFonts(bridge, { node: "1:1" }, async () => {
      throw new Error("offline");
    });

    expect(result.fonts.map((font) => [font.family, font.google])).toEqual([
      ["Manrope", null],
      ["Proxima Nova", null],
    ]);
    expect(result.summary).toMatch(/Google Fonts could not be reached/);
  });
});
