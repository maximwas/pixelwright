import * as z from "zod";
import type { SnapshotNode } from "../types/snapshot.ts";

/** What the plugin sends for Figma's `figma.mixed`: a property that differs across a node's parts. */
export const MIXED = "mixed";

const MixedSchema = z.literal(MIXED);
const ColorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number().optional(),
});
const BoundVariablesSchema = z.record(z.string(), z.unknown());

/** A Figma Paint as the Plugin API gives it; loose, so a paint type Figma adds later still passes. */
export const PaintSchema = z.looseObject({
  type: z.string(),
  visible: z.boolean().optional(),
  opacity: z.number().optional(),
  blendMode: z.string().optional(),
  color: ColorSchema.optional(),
  gradientStops: z
    .array(
      z.looseObject({
        position: z.number(),
        color: ColorSchema,
      }),
    )
    .optional(),
  gradientTransform: z.array(z.array(z.number())).optional(),
  imageHash: z.string().nullable().optional(),
  scaleMode: z.string().optional(),
  boundVariables: BoundVariablesSchema.optional(),
});

/** A Figma Effect (shadow or blur) as the Plugin API gives it. */
export const EffectSchema = z.looseObject({
  type: z.string(),
  visible: z.boolean().optional(),
  radius: z.number().optional(),
  color: ColorSchema.optional(),
  offset: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  spread: z.number().optional(),
  blendMode: z.string().optional(),
  showShadowBehindNode: z.boolean().optional(),
  boundVariables: BoundVariablesSchema.optional(),
  /** A blur's kind: NORMAL, or PROGRESSIVE from startRadius at startOffset to radius at endOffset (0–1 of the box). */
  blurType: z.string().optional(),
  startRadius: z.number().optional(),
  startOffset: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  endOffset: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

/** A transition's easing: a named curve, a cubic bezier or a spring. */
const EasingSchema = z.looseObject({
  type: z.string(),
  easingFunctionCubicBezier: z
    .object({
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
    })
    .optional(),
  easingFunctionSpring: z
    .looseObject({
      mass: z.number(),
      stiffness: z.number(),
      damping: z.number(),
    })
    .optional(),
});

/** One prototype interaction: what starts it and what it does; NODE actions carry their destination's name. */
export const ReactionSchema = z.looseObject({
  trigger: z
    .looseObject({
      type: z.string(),
      /** AFTER_TIMEOUT, in seconds. */
      timeout: z.number().optional(),
      /** MOUSE_ENTER and the like, in seconds. */
      delay: z.number().optional(),
    })
    .nullable(),
  actions: z
    .array(
      z.looseObject({
        type: z.string(),
        destinationId: z.string().nullable().optional(),
        destinationName: z.string().optional(),
        navigation: z.string().optional(),
        url: z.string().optional(),
        transition: z
          .looseObject({
            type: z.string(),
            /** In seconds. */
            duration: z.number(),
            direction: z.string().optional(),
            easing: EasingSchema,
          })
          .nullable()
          .optional(),
      }),
    )
    .optional(),
});

const LineHeightSchema = z.looseObject({
  unit: z.string(),
  value: z.number().optional(),
});
const LetterSpacingSchema = z.looseObject({
  unit: z.string(),
  value: z.number(),
});
const FontNameSchema = z.object({
  family: z.string(),
  style: z.string(),
  /** Axis values of a variable font: `{wght: 450}`. */
  variationSettings: z.record(z.string(), z.number()).optional(),
});

/** A text decoration's offset or thickness: pixels, percent of the font size, or Figma's automatic one. */
const DecorationLengthSchema = z.looseObject({
  unit: z.string(),
  value: z.number().optional(),
});

const GridTrackSchema = z.object({
  type: z.string(),
  value: z.number().optional(),
});

/** A run of text with one set of styles (getStyledTextSegments). */
export const TextSegmentSchema = z.looseObject({
  characters: z.string(),
  start: z.number(),
  end: z.number(),
  fontName: FontNameSchema,
  fontSize: z.number(),
  fontWeight: z.number(),
  fontStyle: z.string().optional(),
  textDecoration: z.string(),
  textCase: z.string(),
  lineHeight: LineHeightSchema,
  letterSpacing: LetterSpacingSchema,
  fills: z.array(PaintSchema),
  fillStyleId: z.string(),
  textStyleId: z.string(),
  hyperlink: z
    .looseObject({
      type: z.string(),
      value: z.string(),
    })
    .nullable()
    .optional(),
  textDecorationStyle: z.string().nullable().optional(),
  textDecorationOffset: DecorationLengthSchema.nullable().optional(),
  textDecorationThickness: DecorationLengthSchema.nullable().optional(),
  textDecorationColor: z
    .looseObject({ value: z.union([z.literal("AUTO"), PaintSchema]) })
    .nullable()
    .optional(),
  listOptions: z.looseObject({ type: z.string() }).optional(),
  indentation: z.number().optional(),
  paragraphIndent: z.number().optional(),
  paragraphSpacing: z.number().optional(),
  textWrapStyle: z.string().optional(),
  openTypeFeatures: z.record(z.string(), z.boolean()).optional(),
  boundVariables: BoundVariablesSchema.optional(),
});

const NumberOrMixed = z.union([z.number(), MixedSchema]);
const StyleIdSchema = z.union([z.string(), MixedSchema]);

/**
 * One node of a snapshot, without its children: the raw Figma properties core turns into CSS. Positions are relative
 * to the snapshot's root (absoluteTransform's translation); properties at Figma's defaults are left out.
 */
/** A Motion keyframe's or base value as Figma gives it: FLOAT, COLOR, VECTOR, TEXT_DATA and the rest. */
const MotionValueSchema = z.object({
  type: z.string(),
  value: z.unknown(),
});

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

export const SnapshotNodeSchema: z.ZodType<SnapshotNode, SnapshotNode> = SnapshotFieldsSchema.extend({
  get children() {
    return z.array(SnapshotNodeSchema).optional();
  },
});

/** A style the snapshot's nodes use: its name, and its value for the tokens. */
export const SnapshotStyleSchema = z.looseObject({
  name: z.string(),
  type: z.string(),
  remote: z.boolean(),
  paints: z.array(PaintSchema).optional(),
  effects: z.array(EffectSchema).optional(),
  fontName: FontNameSchema.optional(),
  fontSize: z.number().optional(),
  lineHeight: LineHeightSchema.optional(),
  letterSpacing: LetterSpacingSchema.optional(),
  textCase: z.string().optional(),
  textDecoration: z.string().optional(),
  /** Its number among styles of its kind with the same name (2, 3…; see styleNumbers): its token is --Name-2. */
  duplicate: z.number().int().min(2).optional(),
});

/** A variable the snapshot's nodes are bound to, with its value as the first node that uses it sees it. */
export const SnapshotVariableSchema = z.object({
  name: z.string(),
  collection: z.string(),
  resolvedType: z.string(),
  remote: z.boolean(),
  value: z.unknown().optional(),
  /** The name developers gave it per platform (WEB: the CSS variable Dev Mode shows). */
  codeSyntax: z.record(z.string(), z.string()).optional(),
});

/** One end of a Dev Mode measurement: a layer's id and the side measured from (Figma's TOP, RIGHT, BOTTOM, LEFT). */
const MeasuredSideSchema = z.object({
  id: z.string(),
  side: z.string(),
});

export const SnapshotSchema = z.object({
  root: SnapshotNodeSchema,
  styles: z.record(z.string(), SnapshotStyleSchema),
  variables: z.record(z.string(), SnapshotVariableSchema),
  /** The page's Dev Mode measurements with a side on the read layers, with the designer's text when there is one. */
  measurements: z
    .array(
      z.object({
        start: MeasuredSideSchema,
        end: MeasuredSideSchema,
        text: z.string().optional(),
      }),
    )
    .optional(),
});
