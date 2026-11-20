import { describe, expect, it } from "vitest";
import { FontCatalog } from "@/plugin/adapters/figma/fonts/font-catalog.ts";

const STYLES = {
  Inter: ["Regular", "Italic", "Medium", "Semi Bold", "Bold", "Bold Italic", "Book"],
  Roboto: ["Light", "Black"],
};
const fonts = Object.entries(STYLES).flatMap(([family, styles]) =>
  styles.map((style) => ({ fontName: { family, style } })),
);
const catalog = new FontCatalog({ fonts: async () => fonts } as never);

function spec(
  family: string,
  weight: number,
  italic = false,
) {
  return { family, weight, italic, size: 16, lineHeight: { unit: "AUTO" as const } };
}

describe("FontCatalog", () => {
  // P-077: a family in any case, the slant by italic or oblique, a plain Regular before a Book of the same weight.
  it("finds the family in any case, by slant, the plain style first", async () => {
    expect(await catalog.fontName(spec("inter", 400))).toEqual({ family: "Inter", style: "Regular" });
    expect(await catalog.fontName(spec("INTER", 700, true))).toEqual({ family: "Inter", style: "Bold Italic" });
  });

  // P-077: variable fonts report weights like 590, so the nearest within 50 is taken.
  it("takes the nearest weight within 50, and lists the styles when none is near", async () => {
    expect(await catalog.fontName(spec("Inter", 590))).toEqual({ family: "Inter", style: "Semi Bold" });
    await expect(catalog.fontName(spec("Roboto", 500))).rejects.toThrow(
      "Roboto has no weight 500: it has Light, Black.",
    );
  });

  it("takes the font a changed text already uses for that weight", async () => {
    const used = { fontName: { family: "Inter", style: "Medium" }, weight: 590 };

    expect(await catalog.fontName(spec("Inter", 590), [used])).toEqual(used.fontName);
  });

  // Tests line: an unknown family names the near one.
  it("refuses a family Figma lacks with the one it meant", async () => {
    await expect(catalog.fontName(spec("Intr", 400))).rejects.toMatchObject({
      message: "Figma has no font family Intr.",
      hint: "Did you mean Inter?",
    });
  });
});
