import { BORDER_STYLES } from "../../css-mapping/groups/paint/strokes.ts";
import { boxOf, lengthOf, numberOf, splitTop } from "../../css-mapping/values/css-values.ts";
import { fontOf } from "../../css-mapping/values/fonts.ts";
import { decimal } from "../../kernel/numbers.ts";
import type { DesignValues } from "./design-values.ts";
import type { Longhand, LonghandKind } from "./types.ts";

/** The longhands one design attribute sets, from its value as written. */
type Expander = (written: string, values: DesignValues) => Longhand[];

/** The longhand a word of a shorthand sets, told by the value it shows. */
interface WordClass {
  readonly property: string;
  readonly kind: LonghandKind;
  readonly fits: (value: string) => boolean;
}

const SIDES = ["top", "right", "bottom", "left"] as const;
const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;

/** A background layer that is an image: a gradient or a file. */
const IMAGE_LAYER = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(|^url\(/i;

const DECORATION_WORDS: readonly WordClass[] = [
  {
    property: "text-decoration-line",
    kind: "keyword",
    fits: (value) => ["none", "underline", "overline", "line-through"].includes(value),
  },
  {
    property: "text-decoration-style",
    kind: "keyword",
    fits: (value) => ["solid", "double", "dotted", "dashed", "wavy"].includes(value),
  },
  {
    property: "text-decoration-color",
    kind: "color",
    fits: () => true,
  },
];

/** How a property's computed value is compared, when not as a keyword. */
const KINDS: Readonly<Record<string, LonghandKind>> = {
  width: "box",
  height: "box",
  "min-width": "box",
  "max-width": "box",
  "min-height": "box",
  "max-height": "box",
  left: "box",
  right: "box",
  top: "box",
  bottom: "box",
  "row-gap": "length",
  "column-gap": "length",
  "letter-spacing": "length",
  "text-underline-offset": "length",
  "text-decoration-thickness": "length",
  opacity: "number",
  color: "color",
  "box-shadow": "shadows",
  "text-shadow": "shadows",
  transform: "transform",
  "grid-template-columns": "tracks",
  "grid-template-rows": "tracks",
};

/** The shorthands design_read writes, spread into the longhands a computed style holds. */
const EXPANDERS: Readonly<Record<string, Expander>> = {
  padding: sides(
    "padding",
    SIDES.map((side) => `padding-${side}`),
  ),
  "border-radius": sides(
    "border-radius",
    CORNERS.map((corner) => `border-${corner}-radius`),
  ),
  gap: pair("gap", ["row-gap", "column-gap"], "length"),
  overflow: pair("overflow", ["overflow-x", "overflow-y"], "keyword"),
  border: (written, values) => SIDES.flatMap((side) => sorted(written, values, strokeWords(`border-${side}`))),
  ...Object.fromEntries(
    SIDES.map((side): [string, Expander] => [
      `border-${side}`,
      (written, values) => sorted(written, values, strokeWords(`border-${side}`)),
    ]),
  ),
  outline: (written, values) => sorted(written, values, strokeWords("outline")),
  background: backgroundOf,
  font: fontLonghands,
  flex: flexOf,
  "text-decoration": (written, values) => sorted(written, values, DECORATION_WORDS),
};

/** The computed properties one design attribute sets, each with its value as written. */
export function expanded(name: string, written: string, values: DesignValues): Longhand[] {
  const expander = EXPANDERS[name];

  return expander === undefined
    ? [values.longhand(name, KINDS[name] ?? "keyword", written)]
    : expander(written, values);
}

/** A value this check cannot read: said, not compared. */
function unread(property: string, written: string): Longhand {
  return {
    property,
    kind: "unread",
    value: written,
    design: written,
  };
}

/** A box shorthand of 1 to 4 lengths, top (or top left) first and clockwise. */
function sides(shorthand: string, properties: readonly string[]): Expander {
  return (written, values) => {
    const parts = boxOf(splitTop(written, " "));

    return parts === null
      ? [unread(shorthand, written)]
      : parts.map((part, index) => values.longhand(properties[index] ?? shorthand, "length", part));
  };
}

/** A shorthand of one or two values, the second the first when left out. */
function pair(shorthand: string, [first, second]: readonly [string, string], kind: LonghandKind): Expander {
  return (written, values) => {
    const [one, two = one, ...rest] = splitTop(written, " ");

    return one === undefined || two === undefined || rest.length > 0
      ? [unread(shorthand, written)]
      : [values.longhand(first, kind, one), values.longhand(second, kind, two)];
  };
}

/** A border side's or an outline's words: its width, its style and its colour, in any order CSS allows. */
function strokeWords(prefix: string): WordClass[] {
  return [
    {
      property: `${prefix}-width`,
      kind: "length",
      fits: (value) => typeof lengthOf(value) === "number",
    },
    {
      property: `${prefix}-style`,
      kind: "keyword",
      fits: (value) => BORDER_STYLES.has(value),
    },
    {
      property: `${prefix}-color`,
      kind: "color",
      fits: () => true,
    },
  ];
}

/** A shorthand's words sorted into its longhands: each to the first class its value fits, the last taking the rest. */
function sorted(written: string, values: DesignValues, classes: readonly WordClass[]): Longhand[] {
  const words = classes.map((): string[] => []);

  for (const word of splitTop(written, " ")) {
    const value = values.resolved(word).toLowerCase();
    const index = classes.findIndex(({ fits }) => fits(value));

    words[index === -1 ? classes.length - 1 : index]?.push(word);
  }

  return classes.flatMap(({ property, kind }, index) => {
    const given = words[index] ?? [];

    return given.length === 0 ? [] : [values.longhand(property, kind, given.join(" "))];
  });
}

/** A background's colour (only its last layer can be one) and its images, gradients and files, top first. */
function backgroundOf(written: string, values: DesignValues): Longhand[] {
  const layers = splitTop(written, ",");
  const last = layers.at(-1);
  const color = last === undefined || IMAGE_LAYER.test(values.resolved(last).trim()) ? undefined : last;
  const images = color === undefined ? layers : layers.slice(0, -1);

  return [
    ...(color === undefined ? [] : [values.longhand("background-color", "color", color)]),
    ...(images.length === 0 ? [] : [values.longhand("background-image", "images", images.join(", "))]),
  ];
}

/** A font shorthand as what it sets: family, size, weight, style, and the line height in px at its size. */
function fontLonghands(written: string, values: DesignValues): Longhand[] {
  const font = fontOf(values.resolved(written));

  if (font === null) {
    return [unread("font", written)];
  }

  const { lineHeight, size } = font;
  const height =
    lineHeight.unit === "AUTO"
      ? "normal"
      : `${decimal(lineHeight.unit === "PIXELS" ? lineHeight.value : (size * lineHeight.value) / 100)}px`;

  return [
    values.longhand("font-family", "family", font.family),
    values.longhand("font-size", "length", `${decimal(size)}px`),
    values.longhand("font-weight", "number", String(font.weight)),
    values.longhand("font-style", "keyword", font.italic ? "italic" : "normal"),
    values.longhand("line-height", "length", height),
  ];
}

/** flex as the grow it gives: how a layer fills its parent's axis. */
function flexOf(written: string, values: DesignValues): Longhand[] {
  const value = values.resolved(written).trim().toLowerCase();
  const [first = ""] = splitTop(value, " ");
  const grow = value === "none" ? "0" : value === "auto" ? "1" : numberOf(first) === null ? null : first;

  return [grow === null ? unread("flex", written) : values.longhand("flex-grow", "number", grow)];
}
