import { DEFAULT_FONT_AXES } from "../../../constants/css.ts";
import { Color } from "../../../kernel/color/color.ts";
import { sameValue } from "../../../kernel/equality.ts";
import { styleName } from "../../../kernel/names.ts";
import { decimal } from "../../../kernel/numbers.ts";
import type { CssContext } from "../../../types/css.ts";
import type { SnapshotNode, SnapshotStyle, TextSegment } from "../../../types/snapshot.ts";
import { decorationLength, fontShorthand, letterSpacingCss } from "../../values/fonts.ts";
import { paintsCss, UNMAPPED } from "../../values/paints.ts";
import { CASE_CSS } from "./styles.ts";

/** The parts of a run a text style sets, compared with the style's own. */
type FontParts = Pick<
  TextSegment,
  "fontName" | "fontSize" | "lineHeight" | "letterSpacing" | "textCase" | "textDecoration"
>;

/** A run being read: its segment and layer, where its CSS and read-only notes go, and what its style already sets. */
interface Run {
  readonly segment: TextSegment;
  readonly node: SnapshotNode;
  readonly context: CssContext;
  readonly css: Map<string, string>;
  readonly readOnly: [string, string][];
  /** Whether the run's text style sets this part the same: then the run leaves it out. */
  readonly same: (key: keyof FontParts) => boolean;
}

/** Figma's text decorations as CSS's text-decoration lines. */
export const DECORATION_LINES: Readonly<Record<string, string>> = {
  UNDERLINE: "underline",
  STRIKETHROUGH: "line-through",
};

const DECORATION_STYLES: Readonly<Record<string, string>> = {
  WAVY: "wavy",
  DOTTED: "dotted",
  DASHED: "dashed",
};

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
  const style = segment.textStyleId === "" ? undefined : context.styles[segment.textStyleId];
  const styled = style?.type === "TEXT" ? style : undefined;
  const run: Run = {
    segment,
    node,
    context,
    css: new Map(),
    readOnly,
    same: (key) => styled !== undefined && sameAsStyle(styled, segment, key),
  };

  readType(run);
  readFeatures(run);
  readColor(run);

  return {
    css: run.css,
    ...(styled === undefined ? {} : { textStyle: styleName(styled) }),
  };
}

/** The font shorthand, letter spacing, case and decoration, each left out where the text style sets it the same. */
function readType(run: Run): void {
  const { segment, css, same } = run;

  if (!(same("fontName") && same("fontSize") && same("lineHeight"))) {
    css.set("font", fontShorthand(segment));
  }

  const spacing = letterSpacingCss(segment.letterSpacing);

  if (spacing !== null && !same("letterSpacing")) {
    css.set("letter-spacing", spacing);
  }

  const transform = CASE_CSS[segment.textCase];

  if (transform !== undefined && !same("textCase")) {
    css.set("text-transform", transform);
  } else if (segment.textCase.startsWith("SMALL_CAPS")) {
    run.readOnly.push(["font-variant-caps", segment.textCase === "SMALL_CAPS" ? "small-caps" : "all-small-caps"]);
  }

  const line = DECORATION_LINES[segment.textDecoration];

  if (line !== undefined && !same("textDecoration")) {
    readDecoration(run, line);
  }
}

/** An underline or strike: its style and color in the shorthand, its offset and thickness on their own. */
function readDecoration({ segment, context, css }: Run, line: string): void {
  const style = DECORATION_STYLES[segment.textDecorationStyle ?? "SOLID"];
  const paint = segment.textDecorationColor?.value;
  const color =
    paint === undefined || paint === "AUTO" || paint.color === undefined
      ? undefined
      : Color.of(paint.color, context.colorSpace)
          .faded(paint.opacity ?? 1)
          .css();
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

/**
 * OpenType features and variable font axes, read-only. A variable font reports its weight as an axis too: only axes
 * the font shorthand does not already say are kept, and none left at the value a browser draws anyway (optical size at
 * the font size: font-optical-sizing is auto).
 */
function readFeatures({ segment, readOnly }: Run): void {
  const features = Object.entries(segment.openTypeFeatures ?? {});

  if (features.length > 0) {
    readOnly.push([
      "font-feature-settings",
      features.map(([tag, on]) => `"${tag.toLowerCase()}" ${on ? 1 : 0}`).join(", "),
    ]);
  }

  const axes = Object.entries(segment.fontName.variationSettings ?? {}).filter(
    ([axis, value]) =>
      !(axis === "wght" && value === segment.fontWeight) &&
      !(axis === "opsz" && value === segment.fontSize) &&
      DEFAULT_FONT_AXES[axis] !== value,
  );

  if (axes.length > 0) {
    readOnly.push(["font-variation-settings", axes.map(([axis, value]) => `"${axis}" ${decimal(value)}`).join(", ")]);
  }
}

/** The run's colour; a gradient or image fill is read-only, as Figma writes it. */
function readColor({ segment, node, context, css, readOnly }: Run): void {
  const color = paintsCss(segment.fills, segment.fillStyleId === "" ? undefined : segment.fillStyleId, node, context);

  if (color === UNMAPPED) {
    readOnly.push(["color", node.css?.background ?? node.css?.color ?? "a gradient or image fill"]);
  } else if (color !== null) {
    css.set("color", color);
  }
}

function sameAsStyle(style: SnapshotStyle, segment: TextSegment, key: keyof FontParts): boolean {
  if (key === "fontName") {
    // A run of a variable font carries axis values its style's font name does not: family and style decide.
    return style.fontName?.family === segment.fontName.family && style.fontName.style === segment.fontName.style;
  }

  return sameValue(style[key], segment[key]);
}
