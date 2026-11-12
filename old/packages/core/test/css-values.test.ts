import { describe, expect, it } from "vitest";
import {
  Color,
  changeOf,
  cleanOracle,
  closest,
  degreesOf,
  dimensionOf,
  fontShorthand,
  slug,
  splitTop,
  urlsOf,
} from "../src/index.ts";

const props = (tag: string, attributes: Record<string, string>) =>
  changeOf({
    line: 1,
    column: 1,
    tag,
    id: null,
    ref: "new:1",
    parent: null,
    index: 0,
    attributes,
  });

describe("CSS values, read as CSS reads them", () => {
  it("splits outside quotes, parentheses and comments, as before for everything else", () => {
    expect(splitTop("'Foo, Bar', sans-serif", ",")).toEqual(["'Foo, Bar'", "sans-serif"]);
    expect(splitTop("0 5px 0 0 rgba(0, 0, 0, 0.25), inset 0 0 0 1px #000", ",")).toEqual([
      "0 5px 0 0 rgba(0, 0, 0, 0.25)",
      "inset 0 0 0 1px #000",
    ]);
    expect(splitTop('url("a (1).png") center / cover', " ")).toEqual(['url("a (1).png")', "center", "/", "cover"]);
    expect(splitTop("1 / span 2", "/")).toEqual(["1", "span 2"]);
    expect(splitTop("10px  20px", " ")).toEqual(["10px", "20px"]);
  });

  it("takes a font family with a comma inside its quotes whole", () => {
    expect(props("Text", { font: "500 30px/normal 'Foo, Bar', sans-serif" }).change.props.font).toMatchObject({
      family: "Foo, Bar",
    });
  });

  it("takes an image's file with parentheses in its quoted name whole", () => {
    expect(
      props("Frame", { background: 'url("assets/photo (1).png") center / cover no-repeat' }).change.props.fills,
    ).toEqual([
      expect.objectContaining({
        kind: "image",
        src: "assets/photo (1).png",
      }),
    ]);
  });

  it("reads back a font family design_read wrote with a quote in its name", () => {
    for (const family of ["Kid's Font", 'Say "Hi"', "Back\\slash"]) {
      const font = fontShorthand({
        fontName: {
          family,
          style: "Regular",
        },
        fontSize: 16,
        lineHeight: {
          unit: "PIXELS",
          value: 24,
        },
      });

      expect(props("Text", { font }).change.props.font, font).toMatchObject({ family });
    }
  });

  it("asks for quotes around a file name with spaces", () => {
    expect(props("Frame", { background: "url(my photo.png) center / cover" }).errors).toEqual([
      expect.objectContaining({
        attribute: "background",
        message: expect.stringMatching(/quotes/),
      }),
    ]);
  });

  it("drops var() fallbacks whole, commas and parentheses inside them included", () => {
    expect(cleanOracle("var(--Overlay, rgba(0, 0, 0, 0.50))")).toBe("var(--Overlay)");
    expect(cleanOracle("0 4px 8px 0 var(--Shadow, rgba(0, 0, 0, 0.1)) /* note */")).toBe("0 4px 8px 0 var(--Shadow)");
  });

  it("lists every file a value names, quoted or not", () => {
    expect(urlsOf('url("a (1).png") center, url(b.png), linear-gradient(#000, #fff)')).toEqual(["a (1).png", "b.png"]);
  });
});

describe("colours", () => {
  it("reads every syntax it read before: hex, rgb, hsl, hwb, lab, lch, oklab, oklch, display-p3, names, transparent", () => {
    const rgb = (value: string) => {
      const color = Color.parse(value)?.value() ?? null;

      return color === null ? null : [color.r, color.g, color.b, color.a].map((channel) => Math.round(channel * 255));
    };

    expect(
      [
        "#FFF",
        "#0D99FF",
        "#0D99FF80",
        "rgb(13, 153, 255)",
        "rgba(13, 153, 255, 0.5)",
        "rgb(13 153 255 / 50%)",
        "hsl(205, 100%, 53%)",
        "hwb(205 5% 0%)",
        "lab(60.5 7 -60)",
        "lch(60.5 60 277)",
        "oklab(0.65 -0.05 -0.15)",
        "oklch(0.65 0.16 250)",
        "color(display-p3 0.2 0.6 1)",
        "rebeccapurple",
        "transparent",
        "not a colour",
      ].map(rgb),
    ).toMatchSnapshot();
  });
});

describe("colours in color()", () => {
  it("reads the spaces it read before culori/fn: srgb-linear, a98-rgb, prophoto-rgb, rec2020, xyz, xyz-d50, xyz-d65", () => {
    for (const white of [
      "color(srgb-linear 1 1 1)",
      "color(a98-rgb 1 1 1)",
      "color(prophoto-rgb 1 1 1)",
      "color(rec2020 1 1 1)",
      "color(xyz 0.9505 1 1.089)",
      "color(xyz-d65 0.9505 1 1.089)",
      "color(xyz-d50 0.9642 1 0.8252)",
    ]) {
      const color = Color.parse(white)?.value() ?? null;

      expect(color, white).not.toBeNull();

      for (const channel of [color?.r, color?.g, color?.b]) {
        expect(channel, white).toBeCloseTo(1, 2);
      }
    }
  });
});

describe("file names from layer names", () => {
  it("keeps words apart at any punctuation, as variant names need, and folds compatibility characters", () => {
    expect(
      [
        "State=Default, Size=Large",
        "Property 1=Variant2",
        "Btn#Primary",
        "Hero Image@2x",
        "x<y>z",
        "50% off",
        "\ufb01nal",
        "x\u00b2",
        "\u2163 chapter",
        "Kid's Font",
      ].map(slug),
    ).toEqual([
      "state-default-size-large",
      "property-1-variant2",
      "btn-primary",
      "hero-image-2x",
      "x-y-z",
      "50-off",
      "final",
      "x2",
      "iv-chapter",
      "kids-font",
    ]);
  });

  it("keeps a name's letters readable whatever its script, never empty", () => {
    expect(
      [
        "tokyo-magnifier 2",
        "photo 1.5",
        "Логотип компанії",
        "Ґанок / Іконка",
        "Café crème",
        "Icons/arrow-right",
        "",
        "!!!",
      ].map(slug),
    ).toEqual([
      "tokyo-magnifier-2",
      "photo-1-5",
      "lohotyp-kompaniyi",
      "ganok-ikonka",
      "cafe-creme",
      "icons-arrow-right",
      "asset",
      "asset",
    ]);
  });
});

describe("Did you mean", () => {
  it("names the closest candidate within a third of the name (at least 2 edits), ignoring case, the first on a tie", () => {
    expect(closest("Headng", ["Header", "Heading"])).toBe("Heading");
    expect(closest("HEADING", ["Heading"])).toBe("Heading");
    expect(closest("abcdef", ["abcxyf"])).toBe("abcxyf");
    expect(closest("abcdef", ["abxyzf"])).toBeNull();
    expect(closest("Cat", ["Bat", "Hat"])).toBe("Bat");
    expect(closest("Div", ["Frame", "Text"])).toBeNull();
    expect(closest("Frame", [])).toBeNull();
  });
});

describe("dimensions and angles, as the CSS tokenizer reads them", () => {
  it("reads a number, a percentage or a dimension, any case and sign", () => {
    expect(dimensionOf("12.5PX")).toEqual({
      value: 12.5,
      unit: "px",
    });
    expect(dimensionOf("-50%")).toEqual({
      value: -50,
      unit: "%",
    });
    expect(dimensionOf("+3")).toEqual({
      value: 3,
      unit: "",
    });
    expect(dimensionOf("12px 4px")).toBeNull();
    expect(dimensionOf("var(--x)")).toBeNull();
  });

  it("gives an angle in degrees from deg, grad, rad or turn", () => {
    expect(degreesOf("45deg")).toBe(45);
    expect(degreesOf("0.25turn")).toBe(90);
    expect(degreesOf("100grad")).toBe(90);
    expect(degreesOf(`${Math.PI}rad`)).toBeCloseTo(180, 10);
    expect(degreesOf("45")).toBeNull();
    expect(degreesOf("45px")).toBeNull();
  });
});
