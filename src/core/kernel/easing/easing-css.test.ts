import { describe, expect, it } from "vitest";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const easing = new EasingCss(new NumberFormat());

// K-066, D-64: the one easing writer. Springs drew linear() in 0.7.0; that is Motion's item, so they write nothing yet.
describe("EasingCss", () => {
  it("writes Figma's named curves as CSS keywords where CSS has one", () => {
    expect(easing.css({ type: "EASE_OUT" })).toBe("ease-out");
    expect(easing.css({ type: "EASE_IN_AND_OUT" })).toBe("ease-in-out");
    expect(easing.css({ type: "LINEAR" })).toBe("linear");
  });

  it("writes the other curves as cubic-bezier() with Figma's numbers to 3 decimals", () => {
    expect(easing.css({ type: "EASE_IN_BACK" })).toBe("cubic-bezier(0.36, 0, 0.66, -0.56)");
    expect(
      easing.css({ type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.2, y1: 0, x2: 0.0001, y2: 1 } }),
    ).toBe("cubic-bezier(0.2, 0, 0, 1)");
    expect(easing.css({ type: "CUSTOM_CUBIC_BEZIER", bezier: [0.25, 0.1, 0.25, 1] })).toBe("ease");
  });

  it("holds as step-end", () => {
    expect(easing.css({ type: "HOLD" })).toBe("step-end");
  });

  it("writes no CSS for a spring or a type Figma does not have", () => {
    expect(easing.css({ type: "GENTLE" })).toBeNull();
    expect(easing.css({ type: "CUSTOM_SPRING" })).toBeNull();
    expect(easing.css({ type: "WOBBLY" })).toBeNull();
  });
});
