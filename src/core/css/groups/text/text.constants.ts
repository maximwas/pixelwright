import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import {
  INTENT_DECORATION,
  INTENT_DECORATION_STYLE,
  INTENT_TEXT_ALIGN,
  INTENT_TEXT_CASE,
  INTENT_TEXT_WRAP,
} from "@/shared/write-intents/write-intent.constants.ts";

/** The CSS a text's group writes (its colour is the fills group's; a mixed one comes from its main run here). */
export const TEXT_ATTRIBUTES = [
  CSS_PROPERTY.font,
  CSS_PROPERTY.letterSpacing,
  CSS_PROPERTY.textTransform,
  CSS_PROPERTY.textDecoration,
  CSS_PROPERTY.textUnderlineOffset,
  CSS_PROPERTY.textDecorationThickness,
  CSS_PROPERTY.textAlign,
  CSS_PROPERTY.textWrap,
] as const;

export const TEXT_SOURCES = ["text", "textPath"] as const;

/** What the text writer owns: the text style, the text group's CSS, and a text's colour, in 0.7.0's table order. */
export const TEXT_WRITTEN = [ATTRIBUTE.textStyle, ...TEXT_ATTRIBUTES, CSS_PROPERTY.color] as const;

/** CSS's words for case, alignment, wrapping and a decoration, as Figma's values. */
export const CASE_FIGMA = {
  none: INTENT_TEXT_CASE.ORIGINAL,
  uppercase: INTENT_TEXT_CASE.UPPER,
  lowercase: INTENT_TEXT_CASE.LOWER,
  capitalize: INTENT_TEXT_CASE.TITLE,
} as const;

export const ALIGN_FIGMA = {
  left: INTENT_TEXT_ALIGN.LEFT,
  start: INTENT_TEXT_ALIGN.LEFT,
  center: INTENT_TEXT_ALIGN.CENTER,
  right: INTENT_TEXT_ALIGN.RIGHT,
  end: INTENT_TEXT_ALIGN.RIGHT,
  justify: INTENT_TEXT_ALIGN.JUSTIFIED,
} as const;

export const WRAP_FIGMA = {
  wrap: INTENT_TEXT_WRAP.AUTO,
  balance: INTENT_TEXT_WRAP.BALANCE,
  pretty: INTENT_TEXT_WRAP.PRETTY,
} as const;

export const LINE_FIGMA = {
  none: INTENT_DECORATION.NONE,
  underline: INTENT_DECORATION.UNDERLINE,
  "line-through": INTENT_DECORATION.STRIKETHROUGH,
} as const;

export const DECORATION_STYLE_FIGMA = {
  solid: INTENT_DECORATION_STYLE.SOLID,
  wavy: INTENT_DECORATION_STYLE.WAVY,
  dotted: INTENT_DECORATION_STYLE.DOTTED,
  dashed: INTENT_DECORATION_STYLE.DASHED,
} as const;

/** The decoration's offset and thickness, beside the shorthand, as the one decoration Figma keeps them in. */
export const DECORATION_LENGTHS = [
  [CSS_PROPERTY.textUnderlineOffset, "offset"],
  [CSS_PROPERTY.textDecorationThickness, "thickness"],
] as const;

export const TEXT_ERROR = {
  badFont: (value: string) => `font="${value}" is not "[italic] weight size/line-height 'Family'".`,
  pathLineHeight: "A text path has no line height.",
  pathLineHeightHint: (font: string) => `Give its font without one: font="${font}".`,
  badSpacing: (value: string) => `letter-spacing="${value}" is not in em or px.`,
  badKeyword: (
    attribute: string,
    value: string,
    words: string,
  ) =>
    `${attribute}="${value}" is not one Figma has: ${words}.`,
  badDecoration: (value: string) => `text-decoration="${value}" is not "underline|line-through|none [style] [colour]".`,
  badLength: (attribute: string, value: string) => `${attribute}="${value}" is not a length in px or em, or auto.`,
  dashed: "Figma underlines solid, wavy or dotted: it has no dashed decoration.",
} as const;

export const TEXT_PATTERN = {
  /** A font's "/line-height", taken out of a TextPath's font in the hint. */
  lineHeight: /\s*\/\s*\S+/,
} as const;

/** Figma's values the text group tells apart. */
export const FIGMA_TEXT = {
  textStyle: "TEXT",
  fixed: "FIXED",
  capHeight: "CAP_HEIGHT",
  weightAxis: "wght",
  opticalSizeAxis: "opsz",
} as const;

/** Variable-font axes at the value a browser draws anyway (FX-066): left out. */
export const DEFAULT_FONT_AXES: Readonly<Record<string, number>> = { slnt: 0, ital: 0, wdth: 100 };

/** Left is the default and is left out. */
export const ALIGN_CSS: Readonly<Record<string, string>> = { CENTER: "center", RIGHT: "right", JUSTIFIED: "justify" };

export const WRAP_CSS: Readonly<Record<string, string>> = { BALANCE: "balance", PRETTY: "pretty" };

/** Vertical alignment within a fixed height, as `$css align-content`; top is the default. */
export const VERTICAL_CSS: Readonly<Record<string, string>> = { CENTER: "center", BOTTOM: "end" };

export const LIST_STYLES: Readonly<Record<string, string>> = { ORDERED: "decimal", UNORDERED: "disc" };

/** Figma's text decorations as CSS's text-decoration lines, and its decoration styles. */
export const DECORATION_LINES: Readonly<Record<string, string>> = {
  UNDERLINE: "underline",
  STRIKETHROUGH: "line-through",
};

/** A decoration's CSS: the text leaves it to its runs' Spans when not every run has the same one. */
export const DECORATION_PROPERTIES = [
  CSS_PROPERTY.textDecoration,
  CSS_PROPERTY.textUnderlineOffset,
  CSS_PROPERTY.textDecorationThickness,
] as const;

export const DECORATION_STYLES: Readonly<Record<string, string>> = { WAVY: "wavy", DOTTED: "dotted", DASHED: "dashed" };

export const SMALL_CAPS: Readonly<Record<string, string>> = {
  SMALL_CAPS: "small-caps",
  SMALL_CAPS_FORCED: "all-small-caps",
};

/** CSS design_apply cannot write back, shown in `$css`. */
export const TEXT_NOTE = {
  fontFeatureSettings: "font-feature-settings",
  fontVariationSettings: "font-variation-settings",
  fontVariantCaps: "font-variant-caps",
  listStyle: "list-style",
  paragraphSpacing: "paragraph-spacing",
  listSpacing: "list-spacing",
  textIndent: "text-indent",
  textBox: "text-box",
  hangingPunctuation: "hanging-punctuation",
} as const;

/** The parts of a run a text style sets: a run leaves out those its style sets the same (C-111). */
export const STYLED_PART = {
  fontName: "fontName",
  fontSize: "fontSize",
  lineHeight: "lineHeight",
  letterSpacing: "letterSpacing",
  textCase: "textCase",
  textDecoration: "textDecoration",
} as const;

export const TEXT_VALUE = {
  space: " ",
  joint: ", ",
  trimBoth: "trim-both cap alphabetic",
  first: "first",
  none: "none",
} as const;

export const TEXT_NUMBER = {
  /** A text on a path's d keeps two decimals, as 0.7.0 wrote it: a path's fractions past that are noise. */
  pathPlaces: 2,
} as const;

/** What the TextPath writer owns: its path, the arc that draws a new one, and where its text starts. */
export const PATH_WRITTEN = [ATTRIBUTE.d, ATTRIBUTE.arc, ATTRIBUTE.start] as const;

/** Where along its path, as a share of the length, text-align anchors a text on a path that gives no start (B-032). */
export const ALIGN_SHARE: Readonly<Record<string, number>> = { center: 0.5, right: 1, end: 1 };

export const PATH_NUMBER = {
  /** A path that draws needs a move and one more command. */
  fewestCommands: 2,
  /** A written path keeps three decimals, 0.7.0's: Figma's vector data takes them. */
  writtenPlaces: 3,
  /** An arc's centre, radius, from and to. */
  arcParts: 5,
  arcLengths: 3,
  circle: 360,
  halfCircle: 180,
  /** One cubic curve per quarter at most stays close to the circle. */
  quarter: 90,
  /** An arc's points to 6 decimals: past float noise (sin 180° is 1.2e-16). */
  pointScale: 1_000_000,
  /** Halvings that find a place on a curve well past the 4 decimals a start keeps. */
  bisections: 30,
  /** A start keeps 4 decimals, as 0.7.0 wrote it. */
  startScale: 10_000,
  /** Float noise at a joint of two pieces. */
  noise: 1e-9,
} as const;

export const PATH_PATTERN = {
  spaces: /\s+/,
  px: /px$/i,
  number: /^-?(?:\d+\.?\d*|\.\d+)$/,
  arcCommand: "A",
  moveCommand: "M",
} as const;

export const PATH_ERROR = {
  madeAlong: "d is the path this <TextPath> was made along: it stays as it is.",
  madeHint: "Figma cannot change a text path's path: delete it and make it again.",
  badPath: (value: string) => `d="${value}" is no SVG path that draws a line.`,
  badPathHint: 'Start it with M: d="M 0 100 C 50 0 150 0 200 100".',
  arcThere: "arc draws the path of a new <TextPath>: this one has its path.",
  arcPlaces: "arc places the path in its parent itself: give no d, left, top, right or bottom with it.",
  badArc: (value: string) =>
    `arc="${value}" is no arc: it is the centre's x and y and the radius in px, then from and to in degrees.`,
  badArcHint:
    'arc="200 200 150 -60 60" runs over the top of a circle: 0 is the top and degrees go clockwise, as CSS turns.',
  badStart: (value: string) => `start="${value}" is not a segment of the path and a place along it, like "0 0.5".`,
  badStartHint: "Segments count from 0 along the path; the place goes from 0 at the segment's start to 1 at its end.",
} as const;

export const TEXT_TEXT = {
  feature: (tag: string, on: boolean) => `"${tag.toLowerCase()}" ${on ? 1 : 0}`,
  axis: (axis: string, value: number) => `"${axis}" ${value}`,
  start: (segment: number, position: number) => `${segment} ${position}`,
} as const;
