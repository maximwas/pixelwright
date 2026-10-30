import * as zod from "zod/mini";
import { GridTrackSchema, TextPathSchema, TextSegmentSchema } from "@/shared/read-model/layer-text.schema.ts";
import {
  BoundVariablesSchema,
  EffectSchema,
  MixedSchema,
  PaintSchema,
  ReactionSchema,
} from "@/shared/read-model/layer-values.schema.ts";
import { READ_MODEL } from "@/shared/read-model/read-model.constants.ts";

const NumberOrMixed = zod.union([zod.number(), MixedSchema]);
const StyleIdSchema = zod.union([zod.string(), MixedSchema]);
const BoxSchema = zod.strictObject({ x: zod.number(), y: zod.number(), width: zod.number(), height: zod.number() });

/** A Motion keyframe's or base value as Figma gives it: FLOAT, COLOR, VECTOR, TEXT_DATA and the rest. */
const MotionValueSchema = zod.strictObject({ type: zod.string(), value: zod.unknown() });

/** A text's own fields; its runs carry their styles. */
const TextSchema = zod.strictObject({
  characters: zod.string(),
  textAutoResize: zod.string(),
  textAlignHorizontal: zod.string(),
  textAlignVertical: zod.string(),
  textTruncation: zod.exactOptional(zod.string()),
  maxLines: zod.exactOptional(zod.nullable(zod.number())),
  paragraphSpacing: zod.exactOptional(NumberOrMixed),
  /** The space between a list's items, apart from paragraph spacing. */
  listSpacing: zod.exactOptional(zod.number()),
  leadingTrim: zod.exactOptional(zod.string()),
  hangingPunctuation: zod.exactOptional(zod.boolean()),
  segments: zod.array(TextSegmentSchema),
});

const InstanceSchema = zod.strictObject({
  componentId: zod.string(),
  componentName: zod.string(),
  componentKey: zod.exactOptional(zod.string()),
  /** The main component comes from a library: its id is this file's copy, not the library's node id. */
  remote: zod.exactOptional(zod.boolean()),
  setId: zod.exactOptional(zod.string()),
  setName: zod.exactOptional(zod.string()),
  /** The set's key: the same in every file, a library's included (a variant's own key is componentKey). */
  setKey: zod.exactOptional(zod.string()),
  /** The component around it exposes this nested instance: its properties are part of that component's API. */
  exposed: zod.exactOptional(zod.literal(true)),
  properties: zod.record(
    zod.string(),
    zod.strictObject({ type: zod.string(), value: zod.union([zod.string(), zod.boolean()]) }),
  ),
});

/**
 * Figma Motion: the animation styles on the layer (each starting `start` seconds into the timeline) and every keyframe
 * track, a style's keyframes moved to where the style starts. A field is a property (`OPACITY`), a paint (`fills.0`)
 * or an effect's parameter (`effects.0.RADIUS`); `operation` says how a keyframe's value meets `base`.
 */
const MotionSchema = zod.strictObject({
  timeline: zod.exactOptional(zod.number()),
  styles: zod.array(
    zod.strictObject({
      type: zod.string(),
      name: zod.string(),
      start: zod.number(),
      duration: zod.exactOptional(zod.number()),
    }),
  ),
  tracks: zod.array(
    zod.strictObject({
      field: zod.string(),
      operation: zod.string(),
      base: MotionValueSchema,
      style: zod.exactOptional(zod.string()),
      /** A style made it, but which one (so where it starts) is not known: its keyframes start at 0. */
      unplaced: zod.exactOptional(zod.boolean()),
      keyframes: zod.array(
        zod.strictObject({
          t: zod.number(),
          value: MotionValueSchema,
          easing: zod.strictObject({
            type: zod.string(),
            bezier: zod.exactOptional(zod.array(zod.number())),
            bounce: zod.exactOptional(zod.number()),
          }),
        }),
      ),
    }),
  ),
});

/** For a frame without auto layout: the auto layout Figma guesses it has, for a hint. */
const InferredLayoutSchema = zod.looseObject({
  layoutMode: zod.string(),
  itemSpacing: zod.exactOptional(zod.number()),
  primaryAxisAlignItems: zod.exactOptional(zod.string()),
  counterAxisAlignItems: zod.exactOptional(zod.string()),
  paddingTop: zod.exactOptional(zod.number()),
  paddingRight: zod.exactOptional(zod.number()),
  paddingBottom: zod.exactOptional(zod.number()),
  paddingLeft: zod.exactOptional(zod.number()),
});

const LayoutGridSchema = zod.looseObject({
  pattern: zod.string(),
  visible: zod.exactOptional(zod.boolean()),
  alignment: zod.exactOptional(zod.string()),
  count: zod.exactOptional(zod.number()),
  sectionSize: zod.exactOptional(zod.number()),
  gutterSize: zod.exactOptional(zod.number()),
  offset: zod.exactOptional(zod.number()),
});

const ExportSettingSchema = zod.looseObject({
  format: zod.string(),
  suffix: zod.exactOptional(zod.string()),
  constraint: zod.exactOptional(zod.strictObject({ type: zod.string(), value: zod.number() })),
});

/**
 * One layer of a read (K-084), with its children: the raw Figma properties core turns into CSS, under 0.7.0's snapshot
 * names, which baselines v1 store (D-33). Positions are relative to the read's root (absoluteTransform's translation);
 * properties at Figma's defaults are left out; paints, effects and reactions stay loose, so a type Figma adds passes.
 */
export const LayerFieldsSchema = zod.strictObject({
  id: zod.string(),
  name: zod.string(),
  type: zod.string(),
  visible: zod.boolean(),
  x: zod.number(),
  y: zod.number(),
  width: zod.number(),
  height: zod.number(),
  /** The rotated or mirrored node's bounding box, relative to the root; only for such nodes. */
  bounds: zod.exactOptional(BoxSchema),
  /**
   * The box the layer draws in, relative to the root, when it reaches past its own (centred or outside strokes,
   * shadows): an icon is exported with all of it.
   */
  renderBounds: zod.exactOptional(BoxSchema),
  rotation: zod.exactOptional(zod.number()),
  /**
   * The relative transform's 2x2 part [a, b, c, d], only for a mirrored layer (negative determinant): Figma reports a
   * horizontal flip as a -180° rotation, and only the matrix tells them apart.
   */
  mirrorTransform: zod.exactOptional(zod.array(zod.number()).check(zod.length(READ_MODEL.matrixEntries))),
  opacity: zod.exactOptional(zod.number()),
  blendMode: zod.exactOptional(zod.string()),
  isMask: zod.exactOptional(zod.boolean()),
  maskType: zod.exactOptional(zod.string()),
  clipsContent: zod.exactOptional(zod.boolean()),
  constraints: zod.exactOptional(zod.strictObject({ horizontal: zod.string(), vertical: zod.string() })),

  layoutMode: zod.exactOptional(zod.string()),
  layoutWrap: zod.exactOptional(zod.string()),
  primaryAxisAlignItems: zod.exactOptional(zod.string()),
  counterAxisAlignItems: zod.exactOptional(zod.string()),
  counterAxisAlignContent: zod.exactOptional(zod.string()),
  itemSpacing: zod.exactOptional(zod.number()),
  counterAxisSpacing: zod.exactOptional(zod.nullable(zod.number())),
  paddingTop: zod.exactOptional(zod.number()),
  paddingRight: zod.exactOptional(zod.number()),
  paddingBottom: zod.exactOptional(zod.number()),
  paddingLeft: zod.exactOptional(zod.number()),
  itemReverseZIndex: zod.exactOptional(zod.boolean()),
  strokesIncludedInLayout: zod.exactOptional(zod.boolean()),
  gridRowCount: zod.exactOptional(zod.number()),
  gridColumnCount: zod.exactOptional(zod.number()),
  gridRowGap: zod.exactOptional(zod.number()),
  gridColumnGap: zod.exactOptional(zod.number()),
  gridRowSizes: zod.exactOptional(zod.array(GridTrackSchema)),
  gridColumnSizes: zod.exactOptional(zod.array(GridTrackSchema)),
  /** Where a grid's child sits: 0-based anchors, spans, and its own alignment in the cell. */
  gridRowAnchorIndex: zod.exactOptional(zod.number()),
  gridColumnAnchorIndex: zod.exactOptional(zod.number()),
  gridRowSpan: zod.exactOptional(zod.number()),
  gridColumnSpan: zod.exactOptional(zod.number()),
  gridChildHorizontalAlign: zod.exactOptional(zod.string()),
  gridChildVerticalAlign: zod.exactOptional(zod.string()),
  layoutSizingHorizontal: zod.exactOptional(zod.string()),
  layoutSizingVertical: zod.exactOptional(zod.string()),
  layoutPositioning: zod.exactOptional(zod.string()),
  layoutGrow: zod.exactOptional(zod.number()),
  layoutAlign: zod.exactOptional(zod.string()),
  minWidth: zod.exactOptional(zod.number()),
  maxWidth: zod.exactOptional(zod.number()),
  minHeight: zod.exactOptional(zod.number()),
  maxHeight: zod.exactOptional(zod.number()),

  fills: zod.exactOptional(zod.union([zod.array(PaintSchema), MixedSchema])),
  strokes: zod.exactOptional(zod.array(PaintSchema)),
  strokeWeight: zod.exactOptional(NumberOrMixed),
  strokeTopWeight: zod.exactOptional(zod.number()),
  strokeRightWeight: zod.exactOptional(zod.number()),
  strokeBottomWeight: zod.exactOptional(zod.number()),
  strokeLeftWeight: zod.exactOptional(zod.number()),
  strokeAlign: zod.exactOptional(zod.string()),
  /** How a line's or a vector's ends are drawn: NONE, ROUND, SQUARE, or an arrow. */
  strokeCap: zod.exactOptional(zod.string()),
  /** The grid style the frame's layout grids come from. */
  gridStyleId: zod.exactOptional(zod.string()),
  dashPattern: zod.exactOptional(zod.array(zod.number())),
  effects: zod.exactOptional(zod.array(EffectSchema)),
  cornerRadius: zod.exactOptional(NumberOrMixed),
  topLeftRadius: zod.exactOptional(zod.number()),
  topRightRadius: zod.exactOptional(zod.number()),
  bottomRightRadius: zod.exactOptional(zod.number()),
  bottomLeftRadius: zod.exactOptional(zod.number()),
  cornerSmoothing: zod.exactOptional(zod.number()),

  fillStyleId: zod.exactOptional(StyleIdSchema),
  strokeStyleId: zod.exactOptional(zod.string()),
  effectStyleId: zod.exactOptional(zod.string()),
  textStyleId: zod.exactOptional(StyleIdSchema),
  boundVariables: zod.exactOptional(BoundVariablesSchema),

  text: zod.exactOptional(TextSchema),
  /** A text on a path's path and start, as Figma has them (vectorPaths in the layer's own coordinates). */
  textPath: zod.exactOptional(TextPathSchema),
  instance: zod.exactOptional(InstanceSchema),
  /** A component's description, for whoever builds it. */
  description: zod.exactOptional(zod.string()),
  /** A component's layer bound to its properties, by field (visible, characters, mainComponent): Figma's keys. */
  componentPropertyReferences: zod.exactOptional(zod.record(zod.string(), zod.string())),
  /**
   * Dev Mode annotations: the designer's notes for developers, with their category's name, and the properties pinned in
   * them (Figma's types, in the order pinned). An annotation has a note, pins, or both.
   */
  annotations: zod.exactOptional(
    zod.array(
      zod.strictObject({
        label: zod.exactOptional(zod.string()),
        category: zod.exactOptional(zod.string()),
        pins: zod.exactOptional(zod.array(zod.string())),
      }),
    ),
  ),
  /**
   * The fields an instance overrides on this layer (Figma's names), those a component property carries left out: what
   * the instance changed that its component's properties do not say.
   */
  overrides: zod.exactOptional(zod.array(zod.string())),
  /** Figma's own variable match for an unbound field (inferredVariables), where it found exactly one: field → its id. */
  inferred: zod.exactOptional(zod.record(zod.string(), zod.string())),
  motion: zod.exactOptional(MotionSchema),
  inferredLayout: zod.exactOptional(InferredLayoutSchema),
  /**
   * The variable modes set on the layer (explicitVariableModes), by collection and mode name; the read's root also
   * carries those it takes from above it that are not its collection's default.
   */
  modes: zod.exactOptional(zod.array(zod.strictObject({ collection: zod.string(), mode: zod.string() }))),
  /** A frame detached from a component (Figma keeps where from): the component may be worth using instead. */
  detached: zod.exactOptional(zod.boolean()),
  /** A vector's paths, hashed: two icons alike in everything else may still draw something else. */
  pathHash: zod.exactOptional(zod.string()),
  /** A frame's layout grids, as Figma has them. */
  layoutGrids: zod.exactOptional(zod.array(LayoutGridSchema)),
  /** A text whose font is not installed here: its metrics may be off. */
  missingFont: zod.exactOptional(zod.boolean()),
  /** The URL a prototype interaction opens. */
  href: zod.exactOptional(zod.string()),
  /** Prototype interactions as Figma keeps them, each action's destination named by the plugin. */
  reactions: zod.exactOptional(zod.array(ReactionSchema)),
  /** Export settings the designer gave the layer: it is meant to be an asset, in this format and scale. */
  exportSettings: zod.exactOptional(zod.array(ExportSettingSchema)),
  /** Figma's own CSS for the layer, only when asked for: the oracle for core's CSS, never its output. */
  css: zod.exactOptional(zod.record(zod.string(), zod.string())),
  /** How many children the layer has; fewer listed means the read's budget cut it there (`$children`). */
  childCount: zod.int().check(zod.minimum(0)),
});

/**
 * A layer and its children. Its type is written out (m:46f92ba7): zod infers a recursive getter's type in whichever
 * order the compiler meets it, and the read op's schema, met first, made `children` required.
 */
export const LayerSchema: zod.ZodMiniType<ReadLayer> = zod.strictObject({
  ...LayerFieldsSchema.shape,
  get children() {
    return zod.exactOptional(zod.array(LayerSchema));
  },
});

export type ReadLayer = zod.output<typeof LayerFieldsSchema> & { children?: ReadLayer[] };
