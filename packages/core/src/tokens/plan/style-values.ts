import type { EffectSpec, FigmaProps, PaintSpec } from "../../css-mapping/figma-props.ts";
import { splitTop } from "../../css-mapping/values/css-values.ts";
import { attributesProps } from "../../css-mapping/write-element.ts";
import type { EffectStyleValue, TextStyleValue } from "./types.ts";

/** The kinds of style tokens_apply writes. */
export type StyleKind = "paint" | "text" | "effect";

/** A style's value in Figma's terms, or why its CSS cannot be one. */
export type StyleValue =
  | { readonly paints: readonly PaintSpec[] }
  | TextStyleValue
  | EffectStyleValue
  | { readonly error: string };

/** A style's other property as tokens_read lists it beside the style's own token: --Caption-letter-spacing. */
export interface StyleExtra {
  readonly token: string;
  readonly value: string;
}

/** How one kind of style is read: the attribute of a layer its CSS means the same as, and what of it the style holds. */
interface StyleReader {
  readonly tag: string;
  readonly attribute: string;
  /** The attributes its CSS may set after the main value (`; letter-spacing: 0.4px`), or as tokens_read's also. */
  readonly extras: readonly string[];
  /** The style's value from what its attributes gave the layer; `attributes`, the ones its CSS names. */
  read(props: FigmaProps, value: string, attributes: readonly string[]): StyleValue;
}

/** The effects each attribute of an effect style's CSS stands for. */
const EFFECT_TYPES: Readonly<Record<string, readonly EffectSpec["type"][]>> = {
  "box-shadow": ["DROP_SHADOW", "INNER_SHADOW"],
  filter: ["LAYER_BLUR"],
  "backdrop-filter": ["BACKGROUND_BLUR"],
};

const STYLE_READERS: Readonly<Record<StyleKind, StyleReader>> = {
  paint: {
    tag: "Frame",
    attribute: "background",
    extras: [],
    read: paintValue,
  },
  text: {
    tag: "Text",
    attribute: "font",
    extras: ["letter-spacing", "text-transform"],
    read: fontValue,
  },
  effect: {
    tag: "Frame",
    attribute: "box-shadow",
    extras: ["filter", "backdrop-filter"],
    read: effectValue,
  },
};

/** A `property: value` piece of a style's CSS. */
const DECLARATION = /^([a-z-]+)\s*:\s*(.*)$/s;

/**
 * A style's CSS value as tokens_read writes it, read by design_apply's own rules: a paint style's as a background
 * (colours and colour variables), a text style's as the font shorthand with its letter spacing and case (after it as
 * `; letter-spacing: …`, or as tokens_read's also), an effect style's as a shadow list with its blurs after it
 * (`; backdrop-filter: blur(20px)`, or the blur alone).
 */
export function styleValueOf(kind: StyleKind, value: string, also: readonly StyleExtra[] = []): StyleValue {
  const reader = STYLE_READERS[kind];
  const attributes = styleAttributes(kind, value, also);

  if (typeof attributes === "string") {
    return { error: attributes };
  }

  const { props, errors } = attributesProps(reader.tag, attributes);

  return errors.length > 0 ? { error: errors.join(" ") } : reader.read(props, value, Object.keys(attributes));
}

/** The style's CSS as a layer's attributes: its main value, then its `property: value` pieces and also; or why not. */
function styleAttributes(kind: StyleKind, value: string, also: readonly StyleExtra[]): Record<string, string> | string {
  const { attribute, extras } = STYLE_READERS[kind];
  const takes = extras.length === 0 ? `only its ${attribute}` : `its ${attribute}, then ${extras.join(", ")}`;
  const attributes: Record<string, string> = {};

  for (const [index, piece] of splitTop(value, ";").entries()) {
    const declared = DECLARATION.exec(piece);
    const property = declared?.[1] ?? (index === 0 ? attribute : "");
    const css = declared?.[2] ?? piece;

    if (property !== attribute && !extras.includes(property)) {
      return `${piece} is not part of a ${kind} style: it takes ${takes}.`;
    }

    attributes[property] = css;
  }

  for (const extra of also) {
    const property = extras.find((name) => extra.token.endsWith(`-${name}`));

    if (property === undefined) {
      return `${extra.token} is not part of a ${kind} style: it takes ${takes}.`;
    }

    attributes[property] = extra.value;
  }

  return attributes;
}

function paintValue({ fills }: FigmaProps, value: string): StyleValue {
  if (fills?.some((paint) => paint.kind === "image") ?? false) {
    return { error: `${value} is an image: a paint style holds colours and colour variables.` };
  }

  return fills === undefined || fills.length === 0
    ? { error: "A paint style holds at least one colour." }
    : { paints: fills };
}

function fontValue({ font, letterSpacing, textCase }: FigmaProps, value: string): StyleValue {
  if (font === undefined) {
    return { error: `${value} is not a font shorthand.` };
  }

  return {
    font,
    ...(letterSpacing === undefined ? {} : { letterSpacing }),
    ...(textCase === undefined ? {} : { textCase }),
  };
}

function effectValue({ effects }: FigmaProps, value: string, attributes: readonly string[]): StyleValue {
  if (effects !== undefined && !Array.isArray(effects)) {
    return { error: `${value} names another style: an effect style holds its shadows and blurs.` };
  }

  return {
    effects: effects ?? [],
    covers: attributes.flatMap((attribute) => EFFECT_TYPES[attribute] ?? []),
  };
}
