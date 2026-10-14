import * as z from "zod";
import { GridTrackSchema, TextSegmentSchema } from "./snapshot-text.ts";
import { BoundVariablesSchema, EffectSchema, MixedSchema, PaintSchema, ReactionSchema } from "./snapshot-values.ts";

const NumberOrMixed = z.union([z.number(), MixedSchema]);
const StyleIdSchema = z.union([z.string(), MixedSchema]);

/** A Motion keyframe's or base value as Figma gives it: FLOAT, COLOR, VECTOR, TEXT_DATA and the rest. */
const MotionValueSchema = z.object({
  type: z.string(),
  value: z.unknown(),
});

/**
 * One node of a snapshot, without its children: the raw Figma properties core turns into CSS. Positions are relative
 * to the snapshot's root (absoluteTransform's translation); properties at Figma's defaults are left out.
 */
export const SnapshotFieldsSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  visible: z.boolean(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  /** The rotated or mirrored node's bounding box, relative to the root; only for such nodes. */
  bounds: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  /**
   * The box the layer draws in, relative to the root, when it reaches past its own (centred or outside strokes,
   * shadows): an icon is exported with all of it.
   */
  renderBounds: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  rotation: z.number().optional(),
  /**
   * The relative transform's 2x2 part [a, b, c, d], only for a mirrored layer (negative determinant): Figma reports a
   * horizontal flip as a -180° rotation, and only the matrix tells them apart.
   */
  mirrorTransform: z.array(z.number()).length(4).optional(),
  opacity: z.number().optional(),
  blendMode: z.string().optional(),
  isMask: z.boolean().optional(),
  maskType: z.string().optional(),
  clipsContent: z.boolean().optional(),
  constraints: z
    .object({
      horizontal: z.string(),
      vertical: z.string(),
    })
    .optional(),

  layoutMode: z.string().optional(),
  layoutWrap: z.string().optional(),
  primaryAxisAlignItems: z.string().optional(),
  counterAxisAlignItems: z.string().optional(),
  counterAxisAlignContent: z.string().optional(),
  itemSpacing: z.number().optional(),
  counterAxisSpacing: z.number().nullable().optional(),
  paddingTop: z.number().optional(),
  paddingRight: z.number().optional(),
  paddingBottom: z.number().optional(),
  paddingLeft: z.number().optional(),
  itemReverseZIndex: z.boolean().optional(),
  strokesIncludedInLayout: z.boolean().optional(),
  gridRowCount: z.number().optional(),
  gridColumnCount: z.number().optional(),
  gridRowGap: z.number().optional(),
  gridColumnGap: z.number().optional(),
  gridRowSizes: z.array(GridTrackSchema).optional(),
  gridColumnSizes: z.array(GridTrackSchema).optional(),
  /** Where a grid's child sits: 0-based anchors, spans, and its own alignment in the cell. */
  gridRowAnchorIndex: z.number().optional(),
  gridColumnAnchorIndex: z.number().optional(),
  gridRowSpan: z.number().optional(),
  gridColumnSpan: z.number().optional(),
  gridChildHorizontalAlign: z.string().optional(),
  gridChildVerticalAlign: z.string().optional(),
  layoutSizingHorizontal: z.string().optional(),
  layoutSizingVertical: z.string().optional(),
  layoutPositioning: z.string().optional(),
  layoutGrow: z.number().optional(),
  layoutAlign: z.string().optional(),
  minWidth: z.number().optional(),
  maxWidth: z.number().optional(),
  minHeight: z.number().optional(),
  maxHeight: z.number().optional(),

  fills: z.union([z.array(PaintSchema), MixedSchema]).optional(),
  strokes: z.array(PaintSchema).optional(),
  strokeWeight: NumberOrMixed.optional(),
  strokeTopWeight: z.number().optional(),
  strokeRightWeight: z.number().optional(),
  strokeBottomWeight: z.number().optional(),
  strokeLeftWeight: z.number().optional(),
  strokeAlign: z.string().optional(),
  /** How a line's or a vector's ends are drawn: NONE, ROUND, SQUARE, or an arrow. */
  strokeCap: z.string().optional(),
  /** The grid style the frame's layout grids come from. */
  gridStyleId: z.string().optional(),
  dashPattern: z.array(z.number()).optional(),
  effects: z.array(EffectSchema).optional(),
  cornerRadius: NumberOrMixed.optional(),
  topLeftRadius: z.number().optional(),
  topRightRadius: z.number().optional(),
  bottomRightRadius: z.number().optional(),
  bottomLeftRadius: z.number().optional(),
  cornerSmoothing: z.number().optional(),

  fillStyleId: StyleIdSchema.optional(),
  strokeStyleId: z.string().optional(),
  effectStyleId: z.string().optional(),
  textStyleId: StyleIdSchema.optional(),
  boundVariables: BoundVariablesSchema.optional(),

  text: z
    .object({
      characters: z.string(),
      textAutoResize: z.string(),
      textAlignHorizontal: z.string(),
      textAlignVertical: z.string(),
      textTruncation: z.string().optional(),
      maxLines: z.number().nullable().optional(),
      paragraphSpacing: NumberOrMixed.optional(),
      /** The space between a list's items, apart from paragraph spacing. */
      listSpacing: z.number().optional(),
      leadingTrim: z.string().optional(),
      hangingPunctuation: z.boolean().optional(),
      segments: z.array(TextSegmentSchema),
    })
    .optional(),
  instance: z
    .object({
      componentId: z.string(),
      componentName: z.string(),
      componentKey: z.string().optional(),
      /** The main component comes from a library: its id is this file's copy, not the library's node id. */
      remote: z.boolean().optional(),
      setId: z.string().optional(),
      setName: z.string().optional(),
      /** The set's key: the same in every file, a library's included (a variant's own key is componentKey). */
      setKey: z.string().optional(),
      /** The component around it exposes this nested instance: its properties are part of that component's API. */
      exposed: z.literal(true).optional(),
      properties: z.record(
        z.string(),
        z.object({
          type: z.string(),
          value: z.union([z.string(), z.boolean()]),
        }),
      ),
    })
    .optional(),
  /** A component's description, for whoever builds it. */
  description: z.string().optional(),
  /**
   * Dev Mode annotations: the designer's notes for developers, with their category's name, and the properties pinned in
   * them (Figma's types, in the order pinned). An annotation has a note, pins, or both.
   */
  annotations: z
    .array(
      z.object({
        label: z.string().optional(),
        category: z.string().optional(),
        pins: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  /**
   * The fields an instance overrides on this layer (Figma's names), those a component property carries left out: what
   * the instance changed that its component's properties do not say.
   */
  overrides: z.array(z.string()).optional(),
  /** Figma's own variable match for an unbound field (inferredVariables), where it found exactly one: field → its id. */
  inferred: z.record(z.string(), z.string()).optional(),
  /**
   * Figma Motion: the animation styles on the layer (each starting `start` seconds into the timeline) and every
   * keyframe track, a style's keyframes moved to where the style starts. A field is a property (`OPACITY`), a paint
   * (`fills.0`) or an effect's parameter (`effects.0.RADIUS`); `operation` says how a keyframe's value meets `base`.
   */
  motion: z
    .object({
      timeline: z.number().optional(),
      styles: z.array(
        z.object({
          type: z.string(),
          name: z.string(),
          start: z.number(),
          duration: z.number().optional(),
        }),
      ),
      tracks: z.array(
        z.object({
          field: z.string(),
          operation: z.string(),
          base: MotionValueSchema,
          style: z.string().optional(),
          /** A style made it, but which one (so where it starts) is not known: its keyframes start at 0. */
          unplaced: z.boolean().optional(),
          keyframes: z.array(
            z.object({
              t: z.number(),
              value: MotionValueSchema,
              easing: z.object({
                type: z.string(),
                bezier: z.array(z.number()).optional(),
                bounce: z.number().optional(),
              }),
            }),
          ),
        }),
      ),
    })
    .optional(),
  /** For a frame without auto layout: the auto layout Figma guesses it has, for a hint. */
  inferredLayout: z
    .looseObject({
      layoutMode: z.string(),
      itemSpacing: z.number().optional(),
      primaryAxisAlignItems: z.string().optional(),
      counterAxisAlignItems: z.string().optional(),
      paddingTop: z.number().optional(),
      paddingRight: z.number().optional(),
      paddingBottom: z.number().optional(),
      paddingLeft: z.number().optional(),
    })
    .optional(),
  /** A frame detached from a component (Figma keeps where from): the component may be worth using instead. */
  detached: z.boolean().optional(),
  /** A vector's paths, hashed: two icons alike in everything else may still draw something else. */
  pathHash: z.string().optional(),
  /** A frame's layout grids, as Figma has them. */
  layoutGrids: z
    .array(
      z.looseObject({
        pattern: z.string(),
        visible: z.boolean().optional(),
        alignment: z.string().optional(),
        count: z.number().optional(),
        sectionSize: z.number().optional(),
        gutterSize: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .optional(),
  /** A text whose font is not installed here: its metrics may be off. */
  missingFont: z.boolean().optional(),
  /** The URL a prototype interaction opens. */
  href: z.string().optional(),
  /** Prototype interactions as Figma keeps them, each action's destination named by the plugin. */
  reactions: z.array(ReactionSchema).optional(),
  /** Export settings the designer gave the layer: it is meant to be an asset, in this format and scale. */
  exportSettings: z
    .array(
      z.looseObject({
        format: z.string(),
        suffix: z.string().optional(),
        constraint: z
          .object({
            type: z.string(),
            value: z.number(),
          })
          .optional(),
      }),
    )
    .optional(),
  /** getCSSAsync's CSS, only when asked for: the oracle for core's own CSS, never its output. */
  css: z.record(z.string(), z.string()).optional(),
  childCount: z.number().int().min(0),
});
