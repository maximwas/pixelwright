import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import { INTENT_ASSET, INTENT_KEY, INTENT_MASK } from "@/shared/write-intents/write-intent.constants.ts";

/** What an element says about its layer beyond CSS: the element writer owns these. */
export const ELEMENT_ATTRIBUTES = [
  ATTRIBUTE.name,
  ATTRIBUTE.href,
  ATTRIBUTE.component,
  ATTRIBUTE.variant,
  ATTRIBUTE.props,
  ATTRIBUTE.description,
  ATTRIBUTE.note,
  ATTRIBUTE.prop,
  ATTRIBUTE.visibleProp,
  ATTRIBUTE.swapProp,
  ATTRIBUTE.mask,
  ATTRIBUTE.src,
] as const;

/** The attributes written as they are, and the Figma property each one is. */
export const ELEMENT_TEXTS = [
  [ATTRIBUTE.name, INTENT_KEY.name],
  [ATTRIBUTE.href, INTENT_KEY.hyperlink],
  [ATTRIBUTE.component, INTENT_KEY.component],
  [ATTRIBUTE.description, INTENT_KEY.description],
] as const;

/** The attributes that are `Name=Value` lists. */
export const ELEMENT_LISTS = [ATTRIBUTE.variant, ATTRIBUTE.props] as const;

/** mask's words as Figma's mask types; none (or empty) is no mask. */
export const MASK_FIGMA: Readonly<Record<string, (typeof INTENT_MASK)[keyof typeof INTENT_MASK]>> = {
  alpha: INTENT_MASK.ALPHA,
  vector: INTENT_MASK.VECTOR,
  luminance: INTENT_MASK.LUMINANCE,
};

/** The tags src makes, and the asset each one is. */
export const ASSET_TAGS: Readonly<Record<string, (typeof INTENT_ASSET)[keyof typeof INTENT_ASSET]>> = {
  Image: INTENT_ASSET.image,
  Icon: INTENT_ASSET.icon,
};

export const ELEMENT_VALUE = {
  noMask: "none",
  /** A note's category ends at the first `: `; a note of pins alone under a category is `Category: [pins]`. */
  category: ": ",
  categoryEnd: ":",
  pinSeparator: ",",
} as const;

export const ELEMENT_PATTERN = {
  /** design_read's notes, `Category: note | Another`: the items between unescaped bars. */
  note: /(?:\\.|[^\\|])+/g,
  /** A note closed by its pins, `Gap is \\[8] [gap, padding]`: its text has no unescaped bracket. */
  pinned: /^((?:\\.|[^\\[])*?)\s*\[([^\\[\]]*)\]\s*$/s,
  /** A backslash escape: the character after it as it is. */
  escape: /\\(.)/g,
} as const;

export const ELEMENT_ERROR = {
  badList: (key: string, value: string) => `${key}="${value}" is not a list of Name=Value, separated by commas.`,
  listHint: "Escape a comma or = in a name or value with a backslash.",
  badMask: (value: string) => `mask="${value}" is not alpha, vector, luminance or none.`,
  srcTag: (tag: string) => `src makes an <Image> or an <Icon>, not a <${tag}>.`,
  srcHint: (src: string) => `Fill it with the picture by its background: background="url(${src})".`,
} as const;

/** Figma's annotation property types as a note's pins word them (C-1.5): CSS words; a type Figma adds later stays as named. */
export const PIN_WORDS: Readonly<Record<string, string>> = {
  width: "width",
  height: "height",
  minWidth: "min-width",
  maxWidth: "max-width",
  minHeight: "min-height",
  maxHeight: "max-height",
  fills: "background",
  strokes: "border",
  effects: "box-shadow",
  strokeWeight: "border-width",
  cornerRadius: "border-radius",
  textStyleId: "text style",
  textAlignHorizontal: "text-align",
  fontFamily: "font-family",
  fontStyle: "font-style",
  fontSize: "font-size",
  fontWeight: "font-weight",
  lineHeight: "line-height",
  letterSpacing: "letter-spacing",
  itemSpacing: "gap",
  padding: "padding",
  layoutMode: "flex-direction",
  alignItems: "align-items",
  opacity: "opacity",
  mainComponent: "component",
  gridRowGap: "row-gap",
  gridColumnGap: "column-gap",
  gridRowCount: "grid rows",
  gridColumnCount: "grid columns",
  gridRowAnchorIndex: "grid-row",
  gridRowSpan: "grid-row",
  gridColumnAnchorIndex: "grid-column",
  gridColumnSpan: "grid-column",
};

/** A text layer's fills are its text colour. */
export const TEXT_PIN_WORDS: Readonly<Record<string, string>> = { fills: "color" };

export const PINS = { separator: ", " } as const;
