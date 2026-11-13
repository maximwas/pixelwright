import * as zod from "zod/mini";
import {
  INTENT_ALIGN_CONTENT,
  INTENT_ASSET,
  INTENT_AXIS,
  INTENT_COLOR_SPACE,
  INTENT_COUNTER_ALIGN,
  INTENT_DECORATION,
  INTENT_DECORATION_STYLE,
  INTENT_EFFECT,
  INTENT_GRADIENT,
  INTENT_HUG,
  INTENT_LAYOUT_MODE,
  INTENT_LAYOUT_WRAP,
  INTENT_MASK,
  INTENT_PAINT,
  INTENT_PRIMARY_ALIGN,
  INTENT_SCALE_MODE,
  INTENT_SELF_ALIGN,
  INTENT_STROKE_ALIGN,
  INTENT_TEXT_ALIGN,
  INTENT_TEXT_CASE,
  INTENT_TEXT_UNIT,
  INTENT_TEXT_WRAP,
  INTENT_TRACK,
  INTENT_UNIT,
} from "@/shared/write-intents/write-intent.constants.ts";

const optional = zod.exactOptional;

/** A value bound to a token (a variable, or a style for paints and effects) by its CSS name. */
const TokenRefSchema = zod.strictObject({ token: zod.string() });

/** A length: pixels, or a token. */
const LengthValueSchema = zod.union([zod.number(), TokenRefSchema]);

const Sides = zod.tuple([LengthValueSchema, LengthValueSchema, LengthValueSchema, LengthValueSchema]);

export const ColorValueSchema = zod.strictObject({
  r: zod.number(),
  g: zod.number(),
  b: zod.number(),
  a: zod.number(),
  space: optional(zod.literal(INTENT_COLOR_SPACE)),
});

const GradientLengthSchema = zod.strictObject({ value: zod.number(), unit: zod.enum(INTENT_UNIT) });

const GradientPointSchema = zod.strictObject({ x: GradientLengthSchema, y: GradientLengthSchema });

const GradientStopSchema = zod.strictObject({
  position: zod.number(),
  color: zod.nullable(ColorValueSchema),
  token: optional(zod.string()),
  /** A token stop faded by color-mix(): the variable's alpha times this. */
  opacity: optional(zod.number()),
});

/** One paint: a colour, a token at an opacity, a gradient as CSS gives it, or an image file. */
export const PaintSpecSchema = zod.looseObject({
  kind: zod.enum(INTENT_PAINT),
  color: optional(ColorValueSchema),
  token: optional(zod.string()),
  opacity: optional(zod.number()),
  type: optional(zod.enum(INTENT_GRADIENT)),
  angle: optional(zod.number()),
  center: optional(GradientPointSchema),
  radii: optional(zod.nullable(GradientPointSchema)),
  stops: optional(zod.array(GradientStopSchema)),
  src: optional(zod.string()),
  scaleMode: optional(zod.enum(INTENT_SCALE_MODE)),
  stream: optional(zod.string()),
});

export const EffectSpecSchema = zod.strictObject({
  type: zod.enum(INTENT_EFFECT),
  radius: zod.number(),
  color: optional(zod.nullable(ColorValueSchema)),
  token: optional(zod.string()),
  x: optional(zod.number()),
  y: optional(zod.number()),
  spread: optional(zod.number()),
});

/** Where an absolute layer sits on one axis of its parent; the plugin turns it into x or y and the constraint. */
const AxisPlacementSchema = zod.strictObject({
  kind: zod.enum(INTENT_AXIS),
  offset: optional(zod.number()),
  start: optional(zod.number()),
  end: optional(zod.number()),
  size: optional(zod.number()),
});

const GridTrackSchema = zod.strictObject({ type: zod.enum(INTENT_TRACK), value: optional(zod.number()) });

/** A grid child's place on one axis: its first track (from 0) and how many tracks it spans. */
const GridSpanSchema = zod.strictObject({ anchor: zod.int(), span: zod.int() });

const TextLengthSchema = zod.strictObject({ unit: zod.enum(INTENT_TEXT_UNIT), value: optional(zod.number()) });

export const FontSpecSchema = zod.strictObject({
  family: zod.string(),
  weight: zod.number(),
  italic: zod.boolean(),
  size: zod.number(),
  lineHeight: TextLengthSchema,
});

const StrokeSpecSchema = zod.strictObject({
  paints: zod.array(PaintSpecSchema),
  weight: optional(zod.number()),
  sides: optional(
    zod.strictObject({ top: zod.number(), right: zod.number(), bottom: zod.number(), left: zod.number() }),
  ),
  align: zod.enum(INTENT_STROKE_ALIGN),
  dash: zod.boolean(),
});

const DecorationSpecSchema = zod.strictObject({
  line: zod.enum(INTENT_DECORATION),
  style: optional(zod.enum(INTENT_DECORATION_STYLE)),
  color: optional(ColorValueSchema),
  offset: optional(TextLengthSchema),
  thickness: optional(TextLengthSchema),
});

/** A note: its category's name as written, its text, and the properties it pins in design_read's words (none: none). */
const NoteSchema = zod.strictObject({
  category: zod.nullable(zod.string()),
  label: zod.string(),
  pins: zod.exactOptional(zod.array(zod.string())),
});

const StringsSchema = zod.record(zod.string(), zod.string());

/**
 * What an element asks of its layer, in Figma's terms (C-181). What depends on the parent (filling its axis, a grid
 * cell, placement against its box) is an intent the plugin resolves on the live parent. Every key is optional: an
 * element leaves out what it does not change.
 */
export const FigmaPropsSchema = zod.strictObject({
  name: optional(zod.string()),
  visible: optional(zod.boolean()),
  layoutMode: optional(zod.enum(INTENT_LAYOUT_MODE)),
  layoutWrap: optional(zod.enum(INTENT_LAYOUT_WRAP)),
  itemSpacing: optional(LengthValueSchema),
  counterAxisSpacing: optional(LengthValueSchema),
  padding: optional(Sides),
  primaryAxisAlignItems: optional(zod.enum(INTENT_PRIMARY_ALIGN)),
  counterAxisAlignItems: optional(zod.enum(INTENT_COUNTER_ALIGN)),
  counterAxisAlignContent: optional(zod.enum(INTENT_ALIGN_CONTENT)),
  gridColumns: optional(zod.array(GridTrackSchema)),
  gridRows: optional(zod.array(GridTrackSchema)),
  gridColumnGap: optional(LengthValueSchema),
  gridRowGap: optional(LengthValueSchema),
  /** A fixed size, or HUG (auto in CSS): the frame or text fits its content. */
  width: optional(zod.union([LengthValueSchema, zod.literal(INTENT_HUG)])),
  height: optional(zod.union([LengthValueSchema, zod.literal(INTENT_HUG)])),
  /** null: no limit. */
  minWidth: optional(zod.nullable(LengthValueSchema)),
  maxWidth: optional(zod.nullable(LengthValueSchema)),
  minHeight: optional(zod.nullable(LengthValueSchema)),
  maxHeight: optional(zod.nullable(LengthValueSchema)),
  /** flex: 1, filling the flex parent's direction. */
  grow: optional(zod.boolean()),
  alignSelf: optional(zod.enum(INTENT_SELF_ALIGN)),
  justifySelf: optional(zod.enum(INTENT_SELF_ALIGN)),
  gridRow: optional(GridSpanSchema),
  gridColumn: optional(GridSpanSchema),
  absolute: optional(zod.boolean()),
  horizontal: optional(AxisPlacementSchema),
  vertical: optional(AxisPlacementSchema),
  rotation: optional(zod.number()),
  mirror: optional(zod.boolean()),
  opacity: optional(zod.number()),
  /** Figma's blend mode; a CSS normal is NORMAL, which the plugin makes a frame's PASS_THROUGH. */
  blendMode: optional(zod.string()),
  mask: optional(zod.strictObject({ isMask: zod.boolean(), maskType: optional(zod.enum(INTENT_MASK)) })),
  clipsContent: optional(zod.boolean()),
  cornerRadius: optional(zod.union([LengthValueSchema, Sides])),
  fills: optional(zod.array(PaintSpecSchema)),
  strokes: optional(StrokeSpecSchema),
  effects: optional(zod.union([zod.array(EffectSpecSchema), TokenRefSchema])),
  hyperlink: optional(zod.string()),
  /** A text style by name; "" detaches the style. */
  textStyle: optional(zod.string()),
  font: optional(FontSpecSchema),
  /** A variable font's axis values by tag (`{wght: 560}`); none returns every axis to the named style's own. */
  fontVariations: optional(zod.record(zod.string(), zod.number())),
  letterSpacing: optional(zod.strictObject({ unit: zod.enum(INTENT_TEXT_UNIT), value: zod.number() })),
  textCase: optional(zod.enum(INTENT_TEXT_CASE)),
  textDecoration: optional(DecorationSpecSchema),
  textAlignHorizontal: optional(zod.enum(INTENT_TEXT_ALIGN)),
  textWrapStyle: optional(zod.enum(INTENT_TEXT_WRAP)),
  /** One-line truncation with an ellipsis. */
  truncate: optional(zod.boolean()),
  textFills: optional(zod.array(PaintSpecSchema)),
  /** An instance's component or component set, by name (or `key:<key>` for a library one). */
  component: optional(zod.string()),
  /** Variant property values: an instance's, or the variant a Component in a set stands for. */
  variant: optional(StringsSchema),
  /** Instance properties by name without Figma's #id. */
  props: optional(StringsSchema),
  description: optional(zod.string()),
  /** Dev Mode annotations, the whole list (an empty one removes them). */
  notes: optional(zod.array(NoteSchema)),
  /** Inside a new Component: the text, visibility or instance swap property this layer makes. */
  property: optional(
    zod.strictObject({ text: optional(zod.string()), visible: optional(zod.string()), swap: optional(zod.string()) }),
  ),
  /** Variable modes by the collection's and the mode's slugs; an empty mode clears the collection's. */
  modes: optional(StringsSchema),
  /** A new TextPath's path, and where its text starts. */
  path: optional(zod.string()),
  pathStart: optional(zod.strictObject({ segment: zod.number(), position: zod.number() })),
  /** An Image's or Icon's file; the server reads it. */
  asset: optional(
    zod.strictObject({
      kind: zod.enum(INTENT_ASSET),
      src: zod.string(),
      stream: optional(zod.string()),
      svg: optional(zod.string()),
    }),
  ),
});

export type FigmaProps = zod.output<typeof FigmaPropsSchema>;

export type GridTrack = zod.output<typeof GridTrackSchema>;
