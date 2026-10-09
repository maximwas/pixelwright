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
  hyperlink: z.unknown().optional(),
  boundVariables: BoundVariablesSchema.optional(),
});

const NumberOrMixed = z.union([z.number(), MixedSchema]);
const StyleIdSchema = z.union([z.string(), MixedSchema]);

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
  /** The rotated node's bounding box, relative to the root; only when the node is rotated. */
  bounds: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  rotation: z.number().optional(),
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
      segments: z.array(TextSegmentSchema),
    })
    .optional(),
  instance: z
    .object({
      componentId: z.string(),
      componentName: z.string(),
      componentKey: z.string().optional(),
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

export const SnapshotSchema = z.object({
  root: SnapshotNodeSchema,
  styles: z.record(z.string(), SnapshotStyleSchema),
  variables: z.record(z.string(), SnapshotVariableSchema),
});
