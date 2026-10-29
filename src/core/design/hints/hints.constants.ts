/** How many examples a hint names. */
export const EXAMPLES = 3;

/** Figma's names for layers nobody named: `Frame 427`, `Rectangle 22957`. */
export const DEFAULT_NAME =
  /^(Frame|Group|Rectangle|Ellipse|Vector|Line|Polygon|Star|Component|Instance|Section|Union|Subtract|Intersect|Exclude) \d+$/;

/** The Figma values the hints read. */
export const HINT_FIGMA = {
  frame: "FRAME",
  component: "COMPONENT",
  instance: "INSTANCE",
  text: "TEXT",
  rectangle: "RECTANGLE",
  solid: "SOLID",
  center: "CENTER",
  absolute: "ABSOLUTE",
  none: "NONE",
  auto: "AUTO",
  vertical: "VERTICAL",
  min: "MIN",
  spaceBetween: "SPACE_BETWEEN",
  color: "COLOR",
  opacity: "opacity",
  borderWidth: "border-width",
  /** Shift+Enter in Figma: a line break inside a paragraph. */
  softBreak: " ",
} as const;

/** How close a rectangle's box must be to its parent's to be its background, in px. */
export const BACKGROUND_SLACK = 1;

/** How far past its room a layer must reach to overflow, in px: Figma's boxes carry float noise. */
export const OVERFLOW_SLACK = 0.5;

/** A turn this small still leaves a layer's box its size, in degrees. */
export const TURN_SLACK = 0.5;

/** Figma's guess at a flow, as CSS: its justify and align values. */
export const GUESS_JUSTIFY: Readonly<Record<string, string>> = {
  CENTER: "center",
  MAX: "flex-end",
  SPACE_BETWEEN: "space-between",
};

export const GUESS_ALIGN: Readonly<Record<string, string>> = {
  CENTER: "center",
  MAX: "flex-end",
  BASELINE: "baseline",
};

/** Colours as design_read writes them raw: hex, rgba() and Display P3. */
export const RAW_COLOR = /#[0-9A-F]{3,8}\b|rgba\([^)]*\)|color\(display-p3 [^)]*\)/g;

/** A token as a value names it: written out before raw colours are looked for. */
export const VAR_USE = /var\([^)]*\)/g;

export const HINT_LABEL = {
  /** A layer as a hint names it: its id and its name. */
  layer: (id: string, name: string) => `${id} "${name}"`,
  /** A few of the layers a hint is about, and how many more. */
  listed: (examples: readonly string[]) =>
    `${examples.slice(0, EXAMPLES).join("; ")}${examples.length > EXAMPLES ? `; and ${examples.length - EXAMPLES} more` : ""}`,
  px: (value: number) => (value === 0 ? "0" : `${value}px`),
  var: (token: string) => `var(${token})`,
  varFallback: (token: string) => `var(${token},`,
  css: (property: string, value: string) => `${property}: ${value}`,
  attribute: (property: string, id: string) => `${property} of ${id}`,
  /** CSS's box shorthand: one, two, three or four sides. */
  box: (
    top: string,
    right: string,
    bottom: string,
    left: string,
  ) => {
    if (top === right && right === bottom && bottom === left) {
      return top;
    }

    if (top === bottom && right === left) {
      return `${top} ${right}`;
    }

    return right === left ? `${top} ${right} ${bottom}` : `${top} ${right} ${bottom} ${left}`;
  },
} as const;

/** Figma's guess at a frame's flow, as the CSS a build could give it. */
export const GUESS_CSS = { display: "display: flex", column: "flex-direction: column", separator: "; " } as const;

/** Each hint's words, frozen by the every-hint golden (C-151): change them only on purpose. */
export const HINT_TEXT = {
  manual: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A frame has no auto layout, so its children are" : `${examples.length} frames have no auto layout, so their children are`} placed absolutely (${HINT_LABEL.listed(examples)}): build them as a flow if they are meant to resize.`,
  manualExample: (
    label: string,
    children: number,
    guess: string | null,
  ) =>
    `${label} with ${children} children${guess === null ? "" : `, Figma reads it as ${guess}`}`,
  overridden: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A layer inside an instance differs from its" : `${examples.length} layers inside instances differ from their`} component outside its properties (${HINT_LABEL.listed(examples)}): give the component a property or a variant for them, or build them as one-offs.`,
  overriddenExample: (label: string, words: string) => `${label}: ${words}`,
  background: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A rectangle covers its parent" : `${examples.length} rectangles cover their parents`} under the content (${HINT_LABEL.listed(examples)}): write each as its parent's background, not as an element.`,
  backgroundExample: (layer: string, parent: string) => `${layer} covers ${parent}`,
  wrapper: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A frame only wraps" : `${examples.length} frames only wrap`} one layer (${HINT_LABEL.listed(examples)}): they may not need elements of their own.`,
  wrapperExample: (label: string, child: string) => `${label} only wraps ${child}`,
  centredStroke: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A layer has a stroke centred on its edge" : `${examples.length} layers have strokes centred on their edges`} (${HINT_LABEL.listed(examples)}): Figma paints half of it outside the box, a CSS border all inside; where it must match to the pixel, use an outline with outline-offset of minus half its width.`,
  detached: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A frame was" : `${examples.length} frames were`} detached from a component (${HINT_LABEL.listed(examples)}): check whether the component fits instead.`,
  autoLineHeight: (examples: readonly string[]) =>
    `line-height normal is Figma's Auto line height: the font's own spacing, about 1.2× the font size for most fonts (${HINT_LABEL.listed(examples)}); where the build must match to the pixel, read with autoLineHeight: "px", which writes the px Figma renders where the read can tell (a text that hugs its lines shows it for its font and size).`,
  softBreak: (examples: readonly string[]) =>
    `&#8232; is a line break inside a paragraph (Shift+Enter in Figma, <br> in HTML), not spaces (${HINT_LABEL.listed(examples)}).`,
  overflow: (examples: readonly string[]) =>
    examples.length === 1
      ? `A layer is wider or taller than the room its auto layout parent gives it, so it overflows the parent in Figma too (${HINT_LABEL.listed(examples)}): decide whether the build wraps, clips or lets it out.`
      : `${examples.length} layers are wider or taller than the room their auto layout parent gives them, so they overflow it in Figma too (${HINT_LABEL.listed(examples)}): decide whether the build wraps, clips or lets them out.`,
  wide: (
    label: string,
    size: string,
    room: string,
  ) => `${label} ${size} wide in ${room}`,
  tall: (
    label: string,
    size: string,
    room: string,
  ) => `${label} ${size} tall in ${room}`,
  defaultName: (examples: string) =>
    `1 layer keeps Figma's default name (${examples}): name it by its role in the code.`,
  defaultNames: (count: number, examples: string) =>
    `${count} layers keep Figma's default names (${examples}${count > EXAMPLES ? ", …" : ""}): name the elements by their role in the code.`,
  missingFonts: (families: readonly string[], examples: string) =>
    `Fonts missing on this machine${families.length > 0 ? ` (${families.join(", ")})` : ""} in ${examples}: Figma could not lay these texts out, so their sizes may be off.`,
  valueless: (token: string, paints: string) =>
    `${token} has no value: its paint style is ${paints}, which neither core nor Figma wrote as CSS here; take its look from a screenshot of a layer that uses it.`,
  /** A numbered style token with its value, and the first style of that name with its own. */
  numbered: (
    token: string,
    style: { readonly type: string; readonly name: string },
    value: string | undefined,
    first: readonly [token: string, value: string | undefined],
  ) =>
    `${token} is another ${style.type.toLowerCase()} style named ${style.name} (${value ?? "no value here"}); ${first[0]} is ${first[1] ?? "not used here"}: they are two styles, keep each where the layer names it.`,
  raw: (
    color: string,
    places: readonly string[],
    token: string | undefined,
  ) =>
    `${color} is written raw ${places.length === 1 ? "once" : `${places.length} times`} (${places.slice(0, EXAMPLES).join(", ")}) and equals ${token}: use the token.`,
  inferred: (
    word: string,
    value: string,
    token: string,
    examples: readonly string[],
  ) =>
    `${word} ${value} on ${examples.length === 1 ? "1 layer" : `${examples.length} layers`} (${HINT_LABEL.listed(examples)}) matches ${token}, Figma's own match for that field: use the token.`,
  examples: ", ",
  paints: " + ",
  empty: "empty",
} as const;
