import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import { type ReadModel, ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";
import { design, lines, reader } from "./support/design-classes.ts";
import { everyHintModel, layer, textLayer } from "./support/every-hint.ts";

const model = (root: object, rest: object = {}): ReadModel =>
  zod.parse(ReadModelSchema, { root, styles: {}, variables: {}, ...rest });

/** Every hint kind's words, in their order, byte for byte as 0.7.0 wrote them (C-151, C-152, C-153, C-193). */
describe("golden hints", () => {
  it("keeps every kind's words, in their order", () => {
    expect(`${JSON.stringify(reader.read(everyHintModel()).hints, null, 2)}\n`).toBe(
      readFileSync(new URL("./__golden__/every-hint.hints.json", import.meta.url), "utf8"),
    );
  });

  it("never reads a raw colour in a text's characters or a layer's name (C-152)", () => {
    const red = { type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0 } };
    const hints = reader.read(
      model(
        layer({
          id: "1:1",
          name: "#F00",
          layoutMode: "VERTICAL",
          children: [textLayer("1:2", "Swatch", "Accent is #F00", { fills: [red], fillStyleId: "S:1" })],
        }),
        { styles: { "S:1": { name: "Accent", type: "PAINT", remote: false, paints: [red] } } },
      ),
    ).hints;

    expect(hints.join("\n")).not.toContain("written raw");
  });
});

/** A card of frames with a left padding of 16, under a root without one. */
const cards = (children: object[], variables: object = {}) =>
  model(layer({ id: "1:1", name: "Cards", layoutMode: "VERTICAL", children }), {
    variables: {
      "V:16": { name: "space/16", collection: "Orbit", resolvedType: "FLOAT", remote: false, value: 16 },
      "V:0": { name: "space/0", collection: "Orbit", resolvedType: "FLOAT", remote: false, value: 0 },
      ...variables,
    },
  });
const card = (id: string, fields: Record<string, unknown> = {}) =>
  layer({ id, name: `Card ${id}`, layoutMode: "VERTICAL", width: 100, height: 40, paddingLeft: 16, ...fields });

describe("Figma's own variable match (C-153)", () => {
  it("names the token Figma matches a raw spacing to, once for every layer using it", () => {
    const inferred = { inferred: { paddingLeft: "V:16" } };

    expect(reader.read(cards([card("1:2", inferred), card("1:3", inferred), card("1:4", inferred)])).hints).toContain(
      'padding 16px on 3 layers (1:2 "Card 1:2"; 1:3 "Card 1:3"; 1:4 "Card 1:4") matches --space-16, Figma\'s own match for that field: use the token.',
    );
  });

  it("never hints a width or a height, whatever Figma matched them to", () => {
    const hints = reader.read(cards([card("1:2", { inferred: { height: "V:16", width: "V:16" } })])).hints;

    expect(hints.join("\n")).not.toContain("--space-16");
  });

  it("leaves out a zero, which every layout without a padding or a gap has", () => {
    const fields = { paddingLeft: 0, itemSpacing: 0, inferred: { paddingLeft: "V:0", itemSpacing: "V:0" } };

    expect(reader.read(cards([card("1:2", fields)])).hints.join("\n")).not.toContain("--space-0");
  });

  it("says a border width with its fractions, as design_read writes the border", () => {
    const fields = {
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
      strokeWeight: 1.5,
      inferred: { strokeWeight: "V:hairline" },
    };
    const hairline = {
      "V:hairline": { name: "stroke/hairline", collection: "Orbit", resolvedType: "FLOAT", remote: false, value: 1.5 },
    };

    expect(reader.read(cards([card("1:2", fields)], hairline)).hints.join("\n")).toMatch(
      /^border-width 1\.5px on 1 layer \(1:2 "Card 1:2"\) matches --stroke-hairline,/m,
    );
  });
});

/** A text of one run with an Auto line height, its box as Figma sizes it. */
const text = (
  id: string,
  characters: string,
  resize: string,
  height: number,
  font: Record<string, unknown> = {},
  block: object = {},
) => {
  const base = textLayer(id, id, characters, font) as { text: object };

  return { ...base, height, text: { ...base.text, textAutoResize: resize, ...block } };
};

/**
 * A label and a two-line title that hug their lines, a body of a fixed width in the label's font and size, a caption
 * in a size no hugging text shows, and a hugging text whose leading is trimmed, which shows no line height.
 */
const CARD = model(
  layer({
    id: "1:1",
    name: "Card",
    width: 400,
    height: 300,
    layoutMode: "VERTICAL",
    children: [
      text("1:2", "Sign in", "WIDTH_AND_HEIGHT", 19),
      text("1:3", "Plans\nand prices", "WIDTH_AND_HEIGHT", 48.4, {
        fontName: { family: "Inter", style: "Medium" },
        fontSize: 20,
        fontWeight: 500,
      }),
      text("1:4", "Every plan includes unlimited projects.", "HEIGHT", 57, { textStyleId: "S:body" }),
      text("1:5", "Billed yearly", "HEIGHT", 15, { fontSize: 12 }),
      text("1:6", "New", "WIDTH_AND_HEIGHT", 9, { fontSize: 12 }, { leadingTrim: "CAP_HEIGHT" }),
    ],
  }),
  {
    styles: {
      "S:body": {
        name: "Body",
        type: "TEXT",
        remote: false,
        fontName: { family: "Inter", style: "Regular" },
        fontSize: 16,
        lineHeight: { unit: "AUTO" },
        letterSpacing: { unit: "PIXELS", value: 0 },
        textCase: "ORIGINAL",
        textDecoration: "NONE",
      },
    },
  },
);

/** Each text's font as the read writes it, by id, and the text styles it names. */
function fontsOf(read: ReadModel) {
  const texts = (element: XmlElement | null): XmlElement[] =>
    element === null ? [] : [...(element.tag === "Text" ? [element] : []), ...element.children.flatMap(texts)];

  return {
    fonts: Object.fromEntries(
      texts(design.render(read).tree).map((element) => [
        element.id,
        element.attributes.find(([name]) => name === "font")?.[1],
      ]),
    ),
    textStyles: reader.read(read).textStyles,
  };
}

const autoHint = (read: ReadModel) => reader.read(read).hints.find((hint) => hint.includes("Auto line height"));

describe("design_read autoLineHeight (T-060, B-038, FX-042)", () => {
  it('writes the px Figma renders an Auto line height at, where the read can tell, with "px"', () => {
    expect(fontsOf(lines.px(CARD))).toEqual({
      fonts: {
        "1:2": "400 16px/19px 'Inter'",
        "1:3": "500 20px/24.2px 'Inter'",
        "1:4": undefined,
        "1:5": "400 12px/normal 'Inter'",
        "1:6": "400 12px/normal 'Inter'",
      },
      textStyles: { Body: "400 16px/19px 'Inter'" },
    });
  });

  it("names the option in the hint on Auto line heights", () => {
    expect(autoHint(CARD)).toContain('autoLineHeight: "px"');
  });

  it("on a px read, gives the hint only for the texts still written normal", () => {
    const hugging = { ...CARD, root: { ...CARD.root, children: (CARD.root.children ?? []).slice(0, 2) } };

    expect(autoHint(lines.px(CARD))).toContain('(1:5 "1:5"; 1:6 "1:6")');
    expect(autoHint(lines.px(hugging))).toBeUndefined();
  });
});
