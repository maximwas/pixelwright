import type { ColorValue } from "../kernel/color/color.ts";

/** A value bound to a token (a variable, or a style for paints and effects) by its CSS name. */
export interface TokenRef {
  readonly token: string;
}

export type LengthValue = number | TokenRef;

/** One paint layer: a colour, a token (a paint style or a colour variable) at an opacity, or an image file. */
export type PaintSpec =
  | { readonly kind: "color"; readonly color: ColorValue }
  | { readonly kind: "token"; readonly token: string; readonly opacity: number }
  | {
      readonly kind: "image";
      /** The file, as the XML names it; the server reads it and names its upload in `stream`. */
      readonly src: string;
      readonly scaleMode: "FILL" | "FIT" | "TILE";
      readonly stream?: string;
    };

export type EffectSpec =
  | {
      readonly type: "DROP_SHADOW" | "INNER_SHADOW";
      readonly color: ColorValue;
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly spread: number;
    }
  | { readonly type: "LAYER_BLUR" | "BACKGROUND_BLUR"; readonly radius: number };

/**
 * Where an absolute layer sits on one axis of its parent, as design_read writes its constraint: from the start or the
 * end edge (MIN, MAX), its start edge's distance from the parent's centre (CENTER), both edges (STRETCH), or percents of
 * the parent (SCALE). The plugin turns it into x or y and the constraint.
 */
export type AxisPlacement =
  | { readonly kind: "MIN" | "MAX" | "CENTER"; readonly offset: number }
  | { readonly kind: "STRETCH"; readonly start: number; readonly end: number }
  | { readonly kind: "SCALE"; readonly start: number; readonly size: number };

export interface GridTrack {
  readonly type: "FLEX" | "FIXED" | "HUG";
  readonly value?: number;
}

/** A grid child's place on one axis: its first track (from 0) and how many tracks it spans. */
export interface GridSpan {
  readonly anchor: number;
  readonly span: number;
}

/**
 * align-self or justify-self. In a grid, the child's place in its cell, STRETCH filling it; in a flex parent,
 * align-self STRETCH fills across the parent's direction and AUTO stops filling.
 */
export type SelfAlign = "AUTO" | "MIN" | "CENTER" | "MAX" | "STRETCH";

export interface FontSpec {
  readonly family: string;
  readonly weight: number;
  readonly italic: boolean;
  readonly size: number;
  readonly lineHeight: { readonly unit: "AUTO" } | { readonly unit: "PIXELS" | "PERCENT"; readonly value: number };
}

/** A decoration's offset or thickness: pixels, percent of the font size (em in CSS), or Figma's own. */
export type TextLength = { readonly unit: "AUTO" } | { readonly unit: "PIXELS" | "PERCENT"; readonly value: number };

/** The whole decoration, as the CSS shorthand resets it: no style is SOLID, no colour, offset or thickness AUTO. */
export interface TextDecorationSpec {
  readonly line: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  readonly style?: "SOLID" | "WAVY" | "DOTTED" | "DASHED";
  readonly color?: ColorValue;
  readonly offset?: TextLength;
  readonly thickness?: TextLength;
}

export interface StrokeSpec {
  readonly paints: readonly PaintSpec[];
  /** One weight on every side, or `sides` when they differ. */
  readonly weight?: number;
  readonly sides?: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** A CSS border is INSIDE (a centred stroke Figma has stays centred), an outline OUTSIDE. */
  readonly align: "INSIDE" | "OUTSIDE";
  readonly dash: boolean;
}

/**
 * What an element asks of its layer, in Figma's terms. What depends on the parent (filling its axis, a grid cell,
 * placement against its box) is an intent the plugin resolves on the live parent.
 */
export interface FigmaProps {
  name?: string;
  visible?: boolean;
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL" | "GRID";
  layoutWrap?: "WRAP" | "NO_WRAP";
  itemSpacing?: LengthValue;
  counterAxisSpacing?: LengthValue;
  padding?: readonly [LengthValue, LengthValue, LengthValue, LengthValue];
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" | "SPACE_EVENLY" | "SPACE_AROUND";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  counterAxisAlignContent?: "AUTO" | "SPACE_BETWEEN";
  gridColumns?: readonly GridTrack[];
  gridRows?: readonly GridTrack[];
  gridColumnGap?: LengthValue;
  gridRowGap?: LengthValue;
  /** A fixed size, or HUG (auto in CSS): the frame or text fits its content. */
  width?: LengthValue | "HUG";
  height?: LengthValue | "HUG";
  /** null: no limit. */
  minWidth?: LengthValue | null;
  maxWidth?: LengthValue | null;
  minHeight?: LengthValue | null;
  maxHeight?: LengthValue | null;
  /** flex: 1, filling the flex parent's direction. */
  grow?: boolean;
  alignSelf?: SelfAlign;
  justifySelf?: SelfAlign;
  gridRow?: GridSpan;
  gridColumn?: GridSpan;
  absolute?: boolean;
  horizontal?: AxisPlacement;
  vertical?: AxisPlacement;
  rotation?: number;
  mirror?: boolean;
  opacity?: number;
  clipsContent?: boolean;
  cornerRadius?: LengthValue | readonly [LengthValue, LengthValue, LengthValue, LengthValue];
  fills?: readonly PaintSpec[];
  strokes?: StrokeSpec;
  effects?: readonly EffectSpec[] | TokenRef;
  hyperlink?: string;
  /** A text style by name; "" detaches the style. */
  textStyle?: string;
  font?: FontSpec;
  letterSpacing?: { readonly unit: "PIXELS" | "PERCENT"; readonly value: number };
  textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
  textDecoration?: TextDecorationSpec;
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textWrapStyle?: "AUTO" | "BALANCE" | "PRETTY";
  /** One-line truncation with an ellipsis. */
  truncate?: boolean;
  textFills?: readonly PaintSpec[];
  /** An instance's component or component set, by name (or `key:<key>` for a library one). */
  component?: string;
  /** Variant property values: an instance's, or the variant a Component in a set stands for. */
  variant?: Readonly<Record<string, string>>;
  /** Instance properties by name without Figma's #id: text values, "true"/"false" for a boolean. */
  props?: Readonly<Record<string, string>>;
  /** A component's or set's description. */
  description?: string;
  /** Dev Mode annotations, the whole list (an empty one removes them). */
  notes?: readonly { readonly category: string | null; readonly label: string }[];
  /** Inside a new Component: the text property (`prop`) or visibility property (`visibleProp`) this layer makes. */
  property?: { readonly text?: string; readonly visible?: string };
  /** An Image's or Icon's file; the server reads it (an image's bytes go as an upload stream, an icon's SVG inline). */
  asset?: { readonly kind: "image" | "icon"; readonly src: string; readonly stream?: string; readonly svg?: string };
}

export interface TextRunSpec {
  readonly start: number;
  readonly end: number;
  readonly props: FigmaProps;
}
