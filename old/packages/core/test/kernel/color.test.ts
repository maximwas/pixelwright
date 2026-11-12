import { describe, expect, it } from "vitest";
import { Color, colorSpaceOf, isChannels } from "../../src/index.ts";

const RED = {
  r: 1,
  g: 0,
  b: 0,
};

describe("Color", () => {
  it("writes an opaque sRGB colour as Dev Mode does: short hex when it shortens", () => {
    expect(Color.of(RED).css()).toBe("#F00");
    expect(
      Color.of({
        r: 0.078,
        g: 0.086,
        b: 0.122,
      }).css(),
    ).toBe("#14161F");
  });

  it("writes a see-through sRGB colour as rgba(), alpha times the opacity it is faded by", () => {
    expect(
      Color.of({
        ...RED,
        a: 0.5,
      })
        .faded(0.5)
        .css(),
    ).toBe("rgba(255, 0, 0, 0.25)");
  });

  it("writes a Display P3 colour with four decimals and its alpha after a slash", () => {
    expect(
      Color.of(
        {
          r: 0.123_456,
          g: 1,
          b: 0,
          a: 0.8,
        },
        "display-p3",
      ).css(),
    ).toBe("color(display-p3 0.1235 1 0 / 0.8)");
  });

  it("gives the sRGB form as a full hex for DTCG, a P3 colour clipped", () => {
    expect(
      Color.of({
        r: 1,
        g: 1,
        b: 1,
      }).hex(),
    ).toBe("#FFFFFF");
    expect(
      Color.of(
        {
          r: 1,
          g: 0,
          b: 0,
          a: 0.5,
        },
        "display-p3",
      ).hex(),
    ).toBe("#FF0000");
  });

  it("converts between sRGB and Display P3, clipping into sRGB", () => {
    const p3Red = Color.of(RED, "display-p3");
    const srgb = p3Red.to("srgb");

    expect(srgb.space).toBe("srgb");
    expect(srgb.channels()).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    });

    const inP3 = Color.of(RED).to("display-p3");

    expect(inP3.space).toBe("display-p3");
    expect(inP3.r).toBeCloseTo(0.9175, 3);
    expect(inP3.g).toBeCloseTo(0.2003, 3);
    expect(inP3.b).toBeCloseTo(0.1386, 3);
    expect(Color.of(RED).to("srgb")).toEqual(Color.of(RED));
  });

  it("parses any CSS colour, keeping a color(display-p3) in P3", () => {
    expect(Color.parse("#ff000080")?.value()).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 128 / 255,
    });
    expect(Color.parse("hsl(0 100% 50%)")?.css()).toBe("#F00");
    expect(Color.parse(" rgb(0 0 255 / 50%) ")?.css()).toBe("rgba(0, 0, 255, 0.5)");
    expect(Color.parse("color(display-p3 1 0 0)")?.value()).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
      space: "display-p3",
    });
    expect(Color.parse("not a colour")).toBeNull();
  });

  it("compares colours within a tolerance, in this colour's space", () => {
    const red = Color.of(RED);

    expect(
      red.equals(
        Color.of({
          ...RED,
          g: 0.0004,
        }),
        0.0005,
      ),
    ).toBe(true);
    expect(
      red.equals(
        Color.of({
          ...RED,
          g: 0.001,
        }),
        0.0005,
      ),
    ).toBe(false);
    expect(red.equals(red.faded(0.5), 0.0005)).toBe(false);
    expect(Color.of(RED, "display-p3").equals(red.to("display-p3"), 0.0005)).toBe(false);
    expect(red.to("display-p3").equals(red, 0.0005)).toBe(true);
  });

  it("measures WCAG contrast on the sRGB form", () => {
    const black = Color.of({
      r: 0,
      g: 0,
      b: 0,
    });
    const white = Color.of({
      r: 1,
      g: 1,
      b: 1,
    });

    expect(black.contrast(white)).toBe(21);
    expect(white.contrast(black)).toBe(21);
    expect(white.luminance()).toBe(1);
  });

  it("lays a see-through colour over a backdrop", () => {
    const veil = Color.of({
      r: 0,
      g: 0,
      b: 0,
      a: 0.5,
    });
    const white = Color.of({
      r: 1,
      g: 1,
      b: 1,
    });

    expect(veil.over(white).channels()).toEqual({
      r: 0.5,
      g: 0.5,
      b: 0.5,
      a: 1,
    });
  });
});

describe("colorSpaceOf", () => {
  it("reads Figma's colour profile: Display P3, else sRGB", () => {
    expect(colorSpaceOf("DISPLAY_P3")).toBe("display-p3");
    expect(colorSpaceOf("LEGACY")).toBe("srgb");
    expect(colorSpaceOf(undefined)).toBe("srgb");
  });
});

describe("isChannels", () => {
  it("knows channels by three numbers", () => {
    expect(isChannels(RED)).toBe(true);
    expect(
      isChannels({
        r: 1,
        g: 0,
      }),
    ).toBe(false);
    expect(
      isChannels({
        r: "1",
        g: 0,
        b: 0,
      }),
    ).toBe(false);
    expect(isChannels(null)).toBe(false);
  });
});
