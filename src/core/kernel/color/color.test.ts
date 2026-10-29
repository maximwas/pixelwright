import { describe, expect, it } from "vitest";
import { Color } from "@/core/kernel/color/color.ts";

const RED = { r: 1, g: 0, b: 0 };
const WHITE = { r: 1, g: 1, b: 1 };

describe("Color", () => {
  // C-1.7: CSS as Dev Mode writes it.
  it("writes an opaque sRGB colour as Dev Mode does: short hex when it shortens", () => {
    expect(Color.of(RED).css()).toBe("#F00");
    expect(Color.of({ r: 0.078, g: 0.086, b: 0.122 }).css()).toBe("#14161F");
  });

  it("writes a see-through sRGB colour as rgba() with 2 decimals, alpha times the opacity it is faded by", () => {
    expect(
      Color.of({ ...RED, a: 0.5 })
        .faded(0.5)
        .css(),
    ).toBe("rgba(255, 0, 0, 0.25)");
  });

  it("writes a Display P3 colour with four decimals and its alpha after a slash", () => {
    expect(Color.of({ r: 0.123_456, g: 1, b: 0, a: 0.8 }, "display-p3").css()).toBe(
      "color(display-p3 0.1235 1 0 / 0.8)",
    );
    expect(Color.of(RED, "display-p3").faded(0.5).css()).toBe("color(display-p3 1 0 0 / 0.5)");
  });

  it("gives the sRGB form as a full hex, a P3 colour clipped", () => {
    expect(Color.of(WHITE).hex()).toBe("#FFFFFF");
    expect(Color.of({ ...RED, a: 0.5 }, "display-p3").hex()).toBe("#FF0000");
  });

  it("converts between sRGB and Display P3, clipping into sRGB", () => {
    const srgb = Color.of(RED, "display-p3").to("srgb");

    expect(srgb.space).toBe("srgb");
    expect(srgb.channels()).toEqual({ r: 1, g: 0, b: 0, a: 1 });

    const inP3 = Color.of(RED).to("display-p3");

    expect(inP3.space).toBe("display-p3");
    expect(inP3.red).toBeCloseTo(0.9175, 3);
    expect(inP3.green).toBeCloseTo(0.2003, 3);
    expect(inP3.blue).toBeCloseTo(0.1386, 3);
  });

  // K-063, B-058: a P3 colour parsed stays P3; parsing it into sRGB would lose what sRGB cannot show.
  it("parses any CSS colour, keeping a color(display-p3) in P3", () => {
    expect(Color.parse("#ff000080")?.value()).toEqual({ r: 1, g: 0, b: 0, a: 128 / 255 });
    expect(Color.parse("hsl(0 100% 50%)")?.css()).toBe("#F00");
    expect(Color.parse(" rgb(0 0 255 / 50%) ")?.css()).toBe("rgba(0, 0, 255, 0.5)");
    expect(Color.parse("color(display-p3 1 0 0)")?.value()).toEqual({ r: 1, g: 0, b: 0, a: 1, space: "display-p3" });
    expect(Color.parse("color(display-p3 0.2314 0.1843 0.851)")?.css()).toBe("color(display-p3 0.2314 0.1843 0.851)");
    expect(Color.parse("not a colour")).toBeNull();
  });

  it("reads the color() spaces culori/fn has only when registered by hand", () => {
    for (const white of [
      "color(srgb-linear 1 1 1)",
      "color(a98-rgb 1 1 1)",
      "color(prophoto-rgb 1 1 1)",
      "color(rec2020 1 1 1)",
      "color(xyz-d65 0.9505 1 1.089)",
      "color(xyz-d50 0.9642 1 0.8252)",
      "oklch(1 0 0)",
      "lab(100 0 0)",
    ]) {
      const color = Color.parse(white)?.value();

      expect(color, white).toBeDefined();
      expect(
        [color?.r, color?.g, color?.b].map((channel) => Math.round((channel ?? 0) * 100) / 100),
        white,
      ).toEqual([1, 1, 1]);
    }
  });

  // O-018: `none` is a missing channel, which Figma has no value for.
  it("refuses a colour with a none channel instead of giving NaN", () => {
    expect(Color.parse("rgb(none 0 0)")).toBeNull();
    expect(Color.parse("color(display-p3 none 0 0)")).toBeNull();
  });

  // K-064: the epsilon a converted colour is compared with.
  it("compares colours within the 0.0005 epsilon, in this colour's space", () => {
    const red = Color.of(RED);

    expect(red.equals(Color.of({ ...RED, g: 0.0004 }))).toBe(true);
    expect(red.equals(Color.of({ ...RED, g: 0.001 }))).toBe(false);
    expect(red.equals(red.faded(0.5))).toBe(false);
    expect(Color.of(RED, "display-p3").equals(red.to("display-p3"))).toBe(false);
    expect(red.to("display-p3").equals(red)).toBe(true);
  });

  // K-064: the wire form carries `space` only for P3.
  it("puts space on the wire only for a Display P3 colour", () => {
    expect(Color.of(RED).value()).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(Color.of(RED, "display-p3").value()).toEqual({ r: 1, g: 0, b: 0, a: 1, space: "display-p3" });
  });

  it("measures WCAG contrast on the sRGB form and lays a see-through colour over a backdrop", () => {
    const black = Color.of({ r: 0, g: 0, b: 0 });

    expect(black.contrast(Color.of(WHITE))).toBe(21);
    expect(Color.of(WHITE).luminance()).toBe(1);
    expect(Color.of({ r: 0, g: 0, b: 0, a: 0.5 }).over(Color.of(WHITE)).channels()).toEqual({
      r: 0.5,
      g: 0.5,
      b: 0.5,
      a: 1,
    });
  });
});
