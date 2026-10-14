import { Color, sameValue, type VariableValueSpec } from "@pixelwright/core";
import { COLOR_EPSILON } from "../../../constants/plugin.ts";
import { documentSpace } from "../../../figma/color-profile.ts";

/**
 * Two values the same as Figma would hold them: colours compared in the file's own space (an sRGB colour written into
 * a Display P3 file is held converted), within COLOR_EPSILON; anything else as JSON would carry it.
 */
export function sameSpec(a: unknown, b: unknown): boolean {
  if (isColorSpec(a) && isColorSpec(b)) {
    return Color.fromValue(a.color).to(documentSpace()).equals(Color.fromValue(b.color), COLOR_EPSILON);
  }

  return sameValue(a, b);
}

function isColorSpec(value: unknown): value is Extract<VariableValueSpec, { kind: "color" }> {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "color";
}
