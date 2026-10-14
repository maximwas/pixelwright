import { decimal, roundTo } from "../../kernel/numbers.ts";
import type { FontSpec, TextLength } from "../../types/apply.ts";
import type { TextSegment } from "../../types/snapshot.ts";
import { weightOf } from "../../utils/font-weight.ts";
import { lengthOf, numberOf, percentOf, splitTop } from "./css-values.ts";
import { px } from "./format.ts";

export function decorationLength(length: TextSegment["textDecorationOffset"]): string | null {
  if (length?.value === undefined) {
    return null;
  }

  return length.unit === "PERCENT" ? `${decimal(length.value / 100)}em` : `${decimal(length.value)}px`;
}

/** `[italic] weight size/line-height 'Family'`, for a run or a text style. */
export function fontShorthand(
  parts: Pick<TextSegment, "fontName" | "fontSize" | "lineHeight"> & {
    fontWeight?: number | undefined;
  },
): string {
  const italic = /italic/i.test(parts.fontName.style) ? "italic " : "";
  const weight = parts.fontWeight ?? weightOf(parts.fontName.style);

  return `${italic}${weight} ${px(parts.fontSize)}/${lineHeightCss(parts.lineHeight, parts.fontSize)} '${parts.fontName.family}'`;
}

/** A line height as CSS writes it at this font size: px, or normal. */
export function lineHeightCss(lineHeight: TextSegment["lineHeight"], fontSize: number): string {
  if (lineHeight.unit === "PIXELS" && lineHeight.value !== undefined) {
    return px(lineHeight.value);
  }

  if (lineHeight.unit === "PERCENT" && lineHeight.value !== undefined) {
    return px((fontSize * lineHeight.value) / 100);
  }

  return "normal";
}

export function letterSpacingCss(spacing: TextSegment["letterSpacing"]): string | null {
  if (spacing.value === 0) {
    return null;
  }

  // Not whole pixels: letter spacing lives in fractions.
  return spacing.unit === "PERCENT" ? `${decimal(spacing.value / 100)}em` : `${decimal(spacing.value)}px`;
}

export function textLengthOf(value: string): TextLength | null {
  if (value === "auto") {
    return { unit: "AUTO" };
  }

  const em = /^(-?\d*\.?\d+)em$/.exec(value);
  const pixels = lengthOf(value);

  if (em !== null) {
    return {
      unit: "PERCENT",
      value: roundTo(Number(em[1]) * 100, 4),
    };
  }

  return typeof pixels === "number"
    ? {
        unit: "PIXELS",
        value: pixels,
      }
    : null;
}

/** `[italic] weight size/line-height 'Family'`, the shorthand design_read writes; a fallback list keeps its first. */
export function fontOf(value: string): FontSpec | null {
  const match =
    /^(?:(italic|oblique|normal)\s+)?(?:(\d{1,4}|normal|bold)\s+)?(\d*\.?\d+)px(?:\s*\/\s*(\S+))?\s+(.+)$/.exec(
      value.trim(),
    );

  if (match === null) {
    return null;
  }

  const [, slant, weight, size, height, families] = match;
  const family = (splitTop(families ?? "", ",")[0] ?? "").replace(/^['"]|['"]$/g, "");
  const lineHeight = lineHeightOf(height);

  if (family === "" || lineHeight === null) {
    return null;
  }

  return {
    family,
    weight: weight === undefined || weight === "normal" ? 400 : weight === "bold" ? 700 : Number(weight),
    italic: slant === "italic" || slant === "oblique",
    size: Number(size),
    lineHeight,
  };
}

export function lineHeightOf(value: string | undefined): FontSpec["lineHeight"] | null {
  if (value === undefined || value === "normal") {
    return { unit: "AUTO" };
  }

  const pixels = /^(\d*\.?\d+)px$/.exec(value);
  const percent = percentOf(value);
  const multiple = numberOf(value.replace(/em$/, ""));

  if (pixels !== null) {
    return {
      unit: "PIXELS",
      value: Number(pixels[1]),
    };
  }

  if (percent !== null) {
    return {
      unit: "PERCENT",
      value: percent,
    };
  }

  return multiple === null
    ? null
    : {
        unit: "PERCENT",
        value: roundTo(multiple * 100, 4),
      };
}
