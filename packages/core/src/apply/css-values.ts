import { converter, parse } from "culori";
import type { ColorValue, LengthValue, PaintSpec, TokenRef } from "../types/apply.ts";

const toRgb = converter("rgb");

/** A value split at a separator that is not inside parentheses: "a(1, 2), b" → ["a(1, 2)", "b"]. */
export function splitTop(value: string, separator: "," | " " | "/"): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of value) {
    depth += char === "(" ? 1 : char === ")" ? -1 : 0;

    if (depth === 0 && (separator === " " ? /\s/.test(char) : char === separator)) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current);

  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/** `var(--name)` → its token name (a fallback after it is left out), else null. */
export function tokenOf(value: string): TokenRef | null {
  const match = /^var\(\s*(--[^,)\s]+)\s*(?:,.*)?\)$/s.exec(value.trim());

  return match?.[1] === undefined ? null : { token: match[1] };
}

/** A length in px ("12px", "0", "-1.5px") or a token; null when it is neither. */
export function lengthOf(value: string): LengthValue | null {
  const token = tokenOf(value);

  if (token !== null) {
    return token;
  }

  const match = /^(-?\d*\.?\d+)(px)?$/.exec(value.trim());

  return match === null || (match[2] === undefined && Number(match[1]) !== 0) ? null : Number(match[1]);
}

/** A plain number ("0.5"). */
export function numberOf(value: string): number | null {
  return /^-?\d*\.?\d+$/.test(value.trim()) ? Number(value) : null;
}

/** A percent ("50%") as its number. */
export function percentOf(value: string): number | null {
  const match = /^(-?\d*\.?\d+)%$/.exec(value.trim());

  return match === null ? null : Number(match[1]);
}

/** Any CSS colour Figma can hold: hex, rgb(), hsl(), a name. */
export function colorOf(value: string): ColorValue | null {
  const parsed = parse(value.trim());
  const rgb = parsed === undefined ? undefined : toRgb(parsed);

  if (rgb === undefined) {
    return null;
  }

  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));

  return {
    r: clamp(rgb.r),
    g: clamp(rgb.g),
    b: clamp(rgb.b),
    a: clamp(rgb.alpha ?? 1),
  };
}

/** A paint: a colour, a token, or a token mixed with transparent at an opacity (how design_read writes those). */
export function paintOf(value: string): PaintSpec | null {
  const token = tokenOf(value);

  if (token !== null) {
    return {
      kind: "token",
      token: token.token,
      opacity: 1,
    };
  }

  const mixed = /^color-mix\(\s*in\s+srgb\s*,\s*var\(\s*(--[^)\s]+)\s*\)\s+(\d*\.?\d+)%\s*,\s*transparent\s*\)$/.exec(
    value.trim(),
  );

  if (mixed?.[1] !== undefined) {
    return {
      kind: "token",
      token: mixed[1],
      opacity: Number(mixed[2]) / 100,
    };
  }

  const color = colorOf(value);

  return color === null
    ? null
    : {
        kind: "color",
        color,
      };
}
