import type { CssContext } from "../types/css.ts";
import type { SnapshotNode, SnapshotStyle, TextSegment } from "../types/snapshot.ts";
import { colorCss } from "./color.ts";
import { decimal, px } from "./format.ts";
import { paintsCss, UNMAPPED } from "./paint.ts";

const TEXT_TRANSFORMS: Readonly<Record<string, string>> = {
  UPPER: "uppercase",
  LOWER: "lowercase",
  TITLE: "capitalize",
};

const TEXT_DECORATIONS: Readonly<Record<string, string>> = {
  UNDERLINE: "underline",
  STRIKETHROUGH: "line-through",
};

const DECORATION_STYLES: Readonly<Record<string, string>> = {
  WAVY: "wavy",
  DOTTED: "dotted",
  DASHED: "dashed",
};

const TEXT_ALIGNS: Readonly<Record<string, string>> = {
  CENTER: "center",
  RIGHT: "right",
  JUSTIFIED: "justify",
};

type FontParts = Pick<
  TextSegment,
  "fontName" | "fontSize" | "lineHeight" | "letterSpacing" | "textCase" | "textDecoration"
>;

/** The run that covers most of a text: its styles are the text's own, the other runs become spans. */
export function baseSegment(segments: readonly TextSegment[]): TextSegment | undefined {
  return segments.reduce<TextSegment | undefined>(
    (longest, segment) =>
      longest === undefined || segment.end - segment.start > longest.end - longest.start ? segment : longest,
    undefined,
  );
}

/**
 * A run of text as CSS: the font shorthand, spacing, case, decoration and color. With a text style, only what differs
 * from the style; `readOnly` gets what the table cannot write back.
 */
export function segmentCss(
  segment: TextSegment,
  node: SnapshotNode,
  context: CssContext,
  readOnly: [string, string][],
): { css: Map<string, string>; textStyle?: string } {
  const css = new Map<string, string>();
  const style = segment.textStyleId === "" ? undefined : context.styles[segment.textStyleId];
  const styled = style?.type === "TEXT" ? style : undefined;
  const same = (key: keyof FontParts) => styled !== undefined && sameAsStyle(styled, segment, key);

  if (!(same("fontName") && same("fontSize") && same("lineHeight"))) {
    css.set("font", fontShorthand(segment));
  }

  const spacing = letterSpacingCss(segment.letterSpacing);

  if (spacing !== null && !same("letterSpacing")) {
    css.set("letter-spacing", spacing);
  }

  const transform = TEXT_TRANSFORMS[segment.textCase];

  if (transform !== undefined && !same("textCase")) {
    css.set("text-transform", transform);
  } else if (segment.textCase.startsWith("SMALL_CAPS")) {
    readOnly.push(["font-variant-caps", segment.textCase === "SMALL_CAPS" ? "small-caps" : "all-small-caps"]);
  }

  const decoration = TEXT_DECORATIONS[segment.textDecoration];

  if (decoration !== undefined && !same("textDecoration")) {
    decorationCss(segment, decoration, css);
  }

  const features = Object.entries(segment.openTypeFeatures ?? {});

  if (features.length > 0) {
    readOnly.push([
      "font-feature-settings",
      features.map(([tag, on]) => `"${tag.toLowerCase()}" ${on ? 1 : 0}`).join(", "),
    ]);
  }

  // A variable font reports its weight as an axis too: only axes the font shorthand does not already say are kept.
  const axes = Object.entries(segment.fontName.variationSettings ?? {}).filter(
    ([axis, value]) => !(axis === "wght" && value === segment.fontWeight),
  );

  if (axes.length > 0) {
    readOnly.push(["font-variation-settings", axes.map(([axis, value]) => `"${axis}" ${decimal(value)}`).join(", ")]);
  }

  const color = paintsCss(segment.fills, segment.fillStyleId === "" ? undefined : segment.fillStyleId, node, context);

  if (color === UNMAPPED) {
    const oracle = node.css?.background ?? node.css?.color;

    readOnly.push(["color", oracle ?? "a gradient or image fill"]);
  } else if (color !== null) {
    css.set("color", color);
  }

  return {
    css,
    ...(styled === undefined ? {} : { textStyle: styled.name }),
  };
}

/** An underline or strike: its style and color in the shorthand, its offset and thickness on their own. */
function decorationCss(segment: TextSegment, line: string, css: Map<string, string>): void {
  const style = DECORATION_STYLES[segment.textDecorationStyle ?? "SOLID"];
  const paint = segment.textDecorationColor?.value;
  const color =
    paint === undefined || paint === "AUTO" || paint.color === undefined
      ? undefined
      : colorCss(paint.color, paint.opacity ?? 1);
  const offset = decorationLength(segment.textDecorationOffset);
  const thickness = decorationLength(segment.textDecorationThickness);

  css.set("text-decoration", [line, style, color].filter((part) => part !== undefined).join(" "));

  if (offset !== null) {
    css.set("text-underline-offset", offset);
  }

  if (thickness !== null) {
    css.set("text-decoration-thickness", thickness);
  }
}

function decorationLength(length: TextSegment["textDecorationOffset"]): string | null {
  if (length?.value === undefined) {
    return null;
  }

  return length.unit === "PERCENT" ? `${decimal(length.value / 100)}em` : `${decimal(length.value)}px`;
}

/** The text's alignment: left is the default and is left out. */
export function textAlignCss(node: SnapshotNode): string | undefined {
  return node.text === undefined ? undefined : TEXT_ALIGNS[node.text.textAlignHorizontal];
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

/** A text style as the textStyles map shows it: its font shorthand plus its spacing and case. */
export function textStyleCss(style: SnapshotStyle): string | null {
  if (style.fontName === undefined || style.fontSize === undefined || style.lineHeight === undefined) {
    return null;
  }

  const parts = [
    fontShorthand({
      fontName: style.fontName,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
    }),
  ];
  const spacing = style.letterSpacing === undefined ? null : letterSpacingCss(style.letterSpacing);
  const transform = style.textCase === undefined ? undefined : TEXT_TRANSFORMS[style.textCase];

  if (spacing !== null) {
    parts.push(`letter-spacing: ${spacing}`);
  }

  if (transform !== undefined) {
    parts.push(`text-transform: ${transform}`);
  }

  return parts.join("; ");
}

function lineHeightCss(lineHeight: TextSegment["lineHeight"], fontSize: number): string {
  if (lineHeight.unit === "PIXELS" && lineHeight.value !== undefined) {
    return px(lineHeight.value);
  }

  if (lineHeight.unit === "PERCENT" && lineHeight.value !== undefined) {
    return px((fontSize * lineHeight.value) / 100);
  }

  return "normal";
}

function letterSpacingCss(spacing: TextSegment["letterSpacing"]): string | null {
  if (spacing.value === 0) {
    return null;
  }

  // Not whole pixels: letter spacing lives in fractions.
  return spacing.unit === "PERCENT" ? `${decimal(spacing.value / 100)}em` : `${decimal(spacing.value)}px`;
}

/** A weight from a style name, for text styles, which carry no weight of their own. */
function weightOf(style: string): number {
  const names: [RegExp, number][] = [
    [/thin|hairline/i, 100],
    [/extra ?light|ultra ?light/i, 200],
    [/semi ?bold|demi ?bold/i, 600],
    [/extra ?bold|ultra ?bold/i, 800],
    [/black|heavy/i, 900],
    [/light/i, 300],
    [/medium/i, 500],
    [/bold/i, 700],
  ];

  return names.find(([pattern]) => pattern.test(style))?.[1] ?? 400;
}

function sameAsStyle(style: SnapshotStyle, segment: TextSegment, key: keyof FontParts): boolean {
  if (key === "fontName") {
    // A run of a variable font carries axis values its style's font name does not: family and style decide.
    return style.fontName?.family === segment.fontName.family && style.fontName.style === segment.fontName.style;
  }

  return canonical(style[key]) === canonical(segment[key]);
}

/** JSON with sorted keys: a style and a run may list the same fields in another order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "object" && item !== null && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}
