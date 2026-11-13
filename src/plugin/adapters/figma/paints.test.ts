import { describe, expect, it } from "vitest";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { NodeLookup } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { Paints } from "@/plugin/adapters/figma/paints.ts";
import { VariableColor } from "@/plugin/adapters/figma/variables/variable-color.ts";

const bound = (opacity: number): SolidPaint => ({
  type: "SOLID",
  color: { r: 0.2, g: 0.4, b: 0.6 },
  opacity,
  boundVariables: { color: { type: "VARIABLE_ALIAS", id: "VariableID:1:2" } },
});

const solid = (opacity: number): SolidPaint => ({ type: "SOLID", color: { r: 1, g: 0, b: 0 }, opacity });

describe("Paints", () => {
  const paints = new Paints(new VariableColor(new NodeLookup()), new GradientGeometry());

  // FX-046, B-048: Figma gives a newly bound paint its variable's alpha as opacity; the wanted one is set again, and a
  // bound paint already at its opacity is never reset.
  it("sets a bound paint's opacity again when Figma changed it", () => {
    expect(paints.again([bound(1), solid(0.3)], [bound(0.4), solid(0.3)])).toEqual([bound(0.4), solid(0.3)]);
  });

  it("leaves bound paints that hold their opacity", () => {
    expect(paints.again([bound(0.4)], [bound(0.4)])).toBeNull();
  });

  // P-080, P-092: paints equal to 4 decimals are the same, so the same paints are not set again.
  it("tells equal paints from changed ones to 4 decimals", () => {
    expect(paints.same([solid(0.30001)], [solid(0.3)])).toBe(true);
    expect(paints.same([solid(0.31)], [solid(0.3)])).toBe(false);
    expect(paints.same([bound(0.4)], [solid(0.4)])).toBe(false);
  });
});
