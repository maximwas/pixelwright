import type { EffectSpec, FigmaProps, FontSpec, PaintSpec } from "../../css-mapping/figma-props.ts";
import { attributeProps } from "../../css-mapping/write-element.ts";

/** The kinds of style tokens_apply writes. */
export type StyleKind = "paint" | "text" | "effect";

/** A style's value in Figma's terms, or why its CSS cannot be one. */
export type StyleValue =
  | { readonly paints: readonly PaintSpec[] }
  | { readonly font: FontSpec }
  | { readonly effects: readonly EffectSpec[] }
  | { readonly error: string };

/** How one kind of style is read: the attribute of a layer its CSS means the same as, and what of it the style holds. */
interface StyleReader {
  readonly tag: string;
  readonly attribute: string;
  read(props: FigmaProps, value: string): StyleValue;
}

const STYLE_READERS: Readonly<Record<StyleKind, StyleReader>> = {
  paint: {
    tag: "Frame",
    attribute: "background",
    read: paintValue,
  },
  text: {
    tag: "Text",
    attribute: "font",
    read: fontValue,
  },
  effect: {
    tag: "Frame",
    attribute: "box-shadow",
    read: shadowValue,
  },
};

/**
 * A style's CSS value as tokens_read writes it, read by design_apply's own rules: a paint style's as a background
 * (colours and colour variables), a text style's as the font shorthand, an effect style's as a shadow list.
 */
export function styleValueOf(kind: StyleKind, value: string): StyleValue {
  const reader = STYLE_READERS[kind];
  const { props, errors } = attributeProps(reader.tag, reader.attribute, value);

  return errors.length > 0 ? { error: errors.join(" ") } : reader.read(props, value);
}

function paintValue({ fills }: FigmaProps, value: string): StyleValue {
  if (fills?.some((paint) => paint.kind === "image") ?? false) {
    return { error: `${value} is an image: a paint style holds colours and colour variables.` };
  }

  return fills === undefined || fills.length === 0
    ? { error: "A paint style holds at least one colour." }
    : { paints: fills };
}

function fontValue({ font }: FigmaProps, value: string): StyleValue {
  return font === undefined ? { error: `${value} is not a font shorthand.` } : { font };
}

function shadowValue({ effects }: FigmaProps, value: string): StyleValue {
  if (effects !== undefined && !Array.isArray(effects)) {
    return { error: `${value} names another style: an effect style holds its shadows.` };
  }

  return { effects: effects ?? [] };
}
