import { type Channels, Color, isChannels } from "../../../kernel/color/color.ts";
import type { ColorSpace } from "../../../kernel/color/color-space.ts";
import { roundTo } from "../../../kernel/numbers.ts";

/** A length as DTCG writes one. */
export interface DtcgDimension {
  readonly value: number;
  readonly unit: "px";
}

/** A variable's value as a DTCG token of its type holds it; what needs no change is kept as it is. */
export function dtcgValue(type: string, value: unknown, space: ColorSpace): unknown {
  if (type === "color") {
    return isChannels(value) ? dtcgColor(value, 1, space) : value;
  }

  if (type === "dimension") {
    return typeof value === "number" ? dtcgPx(value) : value;
  }

  return value;
}

/**
 * A Figma colour as DTCG writes one: its space's components (Display P3 in a P3 file), alpha when see-through, and the
 * sRGB hex fallback (a P3 colour converted and clipped).
 */
export function dtcgColor(channels: Channels, opacity: number, space: ColorSpace): Record<string, unknown> {
  const color = Color.of(channels, space).faded(opacity);
  const alpha = dtcgNumber(color.alpha);

  return {
    colorSpace: space,
    components: [dtcgNumber(color.r), dtcgNumber(color.g), dtcgNumber(color.b)],
    ...(alpha < 1 ? { alpha } : {}),
    hex: color.hex(),
  };
}

export function dtcgPx(value: number): DtcgDimension {
  return {
    value: dtcgNumber(value),
    unit: "px",
  };
}

/** Four decimals, as DTCG files keep numbers. */
export function dtcgNumber(value: number): number {
  return roundTo(value, 4);
}
