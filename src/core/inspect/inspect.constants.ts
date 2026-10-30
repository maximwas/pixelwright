/** Figma's measured sides (Dev Mode), and how a measurement names an end. */
export const MEASURED_SIDE = { left: "LEFT", right: "RIGHT", top: "TOP", bottom: "BOTTOM" } as const;

/** What inspect says in words. */
export const INSPECT_TEXT = {
  end: (id: string, side: string) => `${id} ${side.toLowerCase()}`,
  page: "the page",
  layer: (id: string, name: string) => `${id} "${name}"`,
  auto: "auto",
  px: (value: number) => `${value}px`,
  percent: (value: number, px: string) => `${value}% (${px})`,
} as const;

export const INSPECT_NUMBER = {
  /** How far two boxes may differ and still be the same box: Figma keeps fractions of a pixel (K-059). */
  same: 0.01,
  /** How far a layer may reach past its parent's room before it counts as overflowing (K-059). */
  past: 0.5,
  /** Degrees in a turn: an angle is kept in 0 to 360 (K-060). */
  turn: 360,
  /** A percent line height is this many hundredths of the font size. */
  percent: 100,
} as const;

/** Figma's values inspect reads. */
export const INSPECT_VALUE = {
  /** A reaction without a trigger. */
  noTrigger: "NONE",
  /** Figma's default stroke align, which the read model leaves out. */
  inside: "INSIDE",
  /** A layer auto layout does not place. */
  absolute: "ABSOLUTE",
  variant: "VARIANT",
  pixels: "PIXELS",
  percent: "PERCENT",
  /** Blend modes that blend nothing: a paint's NORMAL, a group's PASS_THROUGH. */
  plainBlends: ["NORMAL", "PASS_THROUGH"],
  /** The room of a parent without auto layout: its whole box. */
  noPadding: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;

/** What ended a text's line: Shift+Enter (U+2028) a line, Enter a paragraph. */
export const TEXT_BREAK = { line: "line", paragraph: "paragraph" } as const;

export const TEXT_BREAKS: Readonly<Record<string, (typeof TEXT_BREAK)[keyof typeof TEXT_BREAK]>> = {
  " ": TEXT_BREAK.line,
  " ": TEXT_BREAK.paragraph,
  "\n": TEXT_BREAK.paragraph,
};

/** The inspect answer's fields, as clients read them (tools.json). */
export const INSPECT_FIELD = {
  relativeTo: 'What the boxes are measured from: a layer as `id "name"`, or the page.',
  around:
    "The point distance and angle are measured from, in the boxes' origin: the given one, or the centre of the given layer.",
  missing: "Ids that are not layers of this file.",
  left: "Layers asked for past the first 100, not read: inspect them next.",
  box: "The layout box.",
  center:
    "The box's centre, in the box's origin; for a turned layer its own centre too, as the box bounds the turned layer.",
  distance: "With around: how far the layer's centre lies from that point, in px.",
  angle:
    "With around: the direction of the layer's centre from that point, in degrees as CSS rotate() turns: 0 straight up, 90 right, 180 down, 270 left (clockwise, 0 to 360). Left out at the point itself.",
  paintedBox: "What is painted, when it differs from the box: centred or outside strokes, shadows, blur.",
  rotation: "Figma's rotation in degrees, counter-clockwise: CSS turns it as rotate(-rotation), as design_read writes.",
  blendMode: "Figma's blend mode, when it blends (SOFT_LIGHT, MULTIPLY): what design_read writes as mix-blend-mode.",
  mixBlendMode: "The blend mode as CSS's mix-blend-mode, when CSS has it.",
  overflow: "How far the layer reaches past the room its parent gives it, in px.",
  effects: "Every effect with Figma's own parameters.",
  fillsCss:
    "The fill as a CSS value, top paint first: a colour, a gradient; a paint CSS cannot hold (a video) says so.",
  fillsStyle: "The paint style it comes from, and the token design_read names it by.",
  fillsTokens: "The variables the paints are bound to, by token, with their values.",
  fillsPaints: "Every visible fill, top first: its type (SOLID, GRADIENT_LINEAR, IMAGE, VIDEO) and its blend mode.",
  bound:
    "The variables bound to the layer's own fields (padding, gap, radius, size), by Figma field: the token design_read writes in var(), and its value.",
} as const;

/** Which of a measured pair holds the other. */
export const MEASURE_SIDE = { a: "a", b: "b" } as const;

/** What measure measured: the layout boxes, or what is painted. */
export const MEASURED = { box: "box", painted: "painted" } as const;

/** Each edge measure compares, and what a sentence calls it when it lines up. */
export const ALIGNED_NAMES = [
  ["left", "lefts"],
  ["right", "rights"],
  ["top", "tops"],
  ["bottom", "bottoms"],
  ["centerX", "centres (x)"],
  ["centerY", "centres (y)"],
] as const;

/** A measured pair in words (K-061): "B is 24 px right of A; tops aligned." */
export const MEASURE_TEXT = {
  named: (id: string, name: string) => `${id} "${name}"`,
  inside: (
    inner: string,
    outer: string,
    inset: { top: number; right: number; bottom: number; left: number },
  ) =>
    `${inner} is inside ${outer}: ${inset.top} px from its top, ${inset.right} from its right, ${inset.bottom} from its bottom, ${inset.left} from its left.`,
  apartX: (gap: number, right: boolean) => `${gap} px ${right ? "right" : "left"} of`,
  apartY: (gap: number, below: boolean) => `${gap} px ${below ? "below" : "above"}`,
  apart: (apart: readonly string[], anchor: string) => `is ${apart.join(" and ")} ${anchor}`,
  overlaps: (
    anchor: string,
    x: number,
    y: number,
  ) => `overlaps ${anchor} by ${x}×${y} px`,
  list: (names: readonly string[]) =>
    names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`,
  sentence: (
    subject: string,
    where: string,
    aligned: string,
  ) =>
    `${subject} ${where}${aligned === "" ? "" : `; ${aligned} aligned`}.`,
} as const;

/** The measure answer's fields, as clients read them (tools.json). */
export const MEASURE_FIELD = {
  gap: "The space between the two boxes on each axis, in px; negative where they overlap on that axis.",
  edges: "B's edge minus A's, in px: 0 is aligned, positive is further right or lower.",
  contains: "Which of the two holds the other within its box.",
  inset: "How far the inner box sits from each edge of the outer one.",
  measured: "The layout boxes, or what is painted (strokes and shadows included).",
  missing: INSPECT_FIELD.missing,
} as const;
