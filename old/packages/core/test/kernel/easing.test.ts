import { describe, expect, it } from "vitest";
import { easingCss } from "../../src/index.ts";

/** The stops of a linear() easing, as numbers. */
const stops = (css: string | null) =>
  (/^linear\((.*)\)$/.exec(css ?? "")?.[1] ?? "").split(",").map((stop) => Number(stop.trim().split(" ")[0]));

describe("easingCss", () => {
  it("writes Figma's named curves as CSS keywords where CSS has one", () => {
    expect(easingCss({ type: "EASE_OUT" })).toBe("ease-out");
    expect(easingCss({ type: "EASE_IN_AND_OUT" })).toBe("ease-in-out");
    expect(easingCss({ type: "LINEAR" })).toBe("linear");
  });

  it("writes the other curves as cubic-bezier() with Figma's numbers", () => {
    expect(easingCss({ type: "EASE_IN_BACK" })).toBe("cubic-bezier(0.36, 0, 0.66, -0.56)");
    expect(
      easingCss({
        type: "CUSTOM_CUBIC_BEZIER",
        easingFunctionCubicBezier: {
          x1: 0.2,
          y1: 0,
          x2: 0.0001,
          y2: 1,
        },
      }),
    ).toBe("cubic-bezier(0.2, 0, 0, 1)");
    expect(
      easingCss({
        type: "CUSTOM_CUBIC_BEZIER",
        bezier: [0.25, 0.1, 0.25, 1],
      }),
    ).toBe("ease");
  });

  it("holds as step-end", () => {
    expect(easingCss({ type: "HOLD" })).toBe("step-end");
  });

  it("writes a physical spring as linear() from 0 to 1, overshooting where the spring does", () => {
    const bouncy = easingCss({
      type: "CUSTOM_SPRING",
      easingFunctionSpring: {
        mass: 1,
        stiffness: 100,
        damping: 10,
      },
    });
    const values = stops(bouncy);

    expect(bouncy).toMatch(/^linear\(0, .*, 1\)$/);
    expect(values.length).toBeGreaterThan(4);
    expect(values.length).toBeLessThanOrEqual(64);
    expect(Math.max(...values)).toBeGreaterThan(1.1);

    const critical = stops(
      easingCss({
        type: "CUSTOM_SPRING",
        easingFunctionSpring: {
          mass: 1,
          stiffness: 100,
          damping: 20,
        },
      }),
    );

    expect(Math.max(...critical)).toBeLessThanOrEqual(1);
    expect(critical).toEqual([...critical].sort((a, b) => a - b));
  });

  it("writes Motion's normalized spring by its bounce, and Figma's spring presets", () => {
    expect(
      Math.max(
        ...stops(
          easingCss({
            type: "CUSTOM_SPRING",
            bounce: 0,
          }),
        ),
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.max(
        ...stops(
          easingCss({
            type: "CUSTOM_SPRING",
            bounce: 0.5,
          }),
        ),
      ),
    ).toBeGreaterThan(1.05);
    expect(easingCss({ type: "GENTLE" })).toMatch(/^linear\(0, .*, 1\)$/);
    expect(easingCss({ type: "BOUNCY" })).toMatch(/^linear\(0, .*, 1\)$/);
  });

  it("knows no easing of a type Figma does not have", () => {
    expect(easingCss({ type: "WOBBLY" })).toBeNull();
  });
});
