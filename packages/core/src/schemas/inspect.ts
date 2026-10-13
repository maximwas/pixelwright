import * as z from "zod";
import { EffectSchema, ReactionSchema, SnapshotFieldsSchema } from "./snapshot.ts";

/** A box in px, from the origin inspect measures from. */
export const InspectBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/** One layer as the plugin's inspect op reads it: its snapshot entry, and where it and its parent are. */
export const InspectedLayerSchema = SnapshotFieldsSchema.extend({
  parent: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
    })
    .nullable(),
  /** The layout box (absoluteBoundingBox). */
  box: InspectBoxSchema,
  /** What is painted (absoluteRenderBounds): strokes outside the box, shadows, blur; null when Figma gives none. */
  paintedBox: InspectBoxSchema.nullable(),
  parentBox: InspectBoxSchema.nullable(),
  /** The parent's padding when it lays its children out (auto layout), else null. */
  parentPadding: z
    .object({
      top: z.number(),
      right: z.number(),
      bottom: z.number(),
      left: z.number(),
    })
    .nullable(),
});

/** The inspect op's answer: the layers found, from `origin`'s top left (the page's when null), and the ids not found. */
export const InspectRawSchema = z.object({
  origin: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  layers: z.array(InspectedLayerSchema),
  missing: z.array(z.string()),
});

/** The inspect tool's answer, per layer (inspectView). */
export const InspectViewSchema = z.object({
  relativeTo: z.string().describe('What the boxes are measured from: a layer as `id "name"`, or the page.'),
  layers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      parent: z
        .object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
        })
        .nullable(),
      box: InspectBoxSchema.describe("The layout box."),
      paintedBox: InspectBoxSchema.exactOptional().describe(
        "What is painted, when it differs from the box: centred or outside strokes, shadows, blur.",
      ),
      rotation: z.number().exactOptional(),
      overflow: z
        .object({
          left: z.number().exactOptional(),
          right: z.number().exactOptional(),
          top: z.number().exactOptional(),
          bottom: z.number().exactOptional(),
        })
        .exactOptional()
        .describe("How far the layer reaches past the room its parent gives it, in px."),
      strokes: z
        .object({
          align: z.string(),
          weight: z.number().exactOptional(),
          weights: z
            .object({
              top: z.number(),
              right: z.number(),
              bottom: z.number(),
              left: z.number(),
            })
            .exactOptional(),
          dashes: z.array(z.number()).exactOptional(),
          colors: z.array(z.string()),
          includedInLayout: z.boolean().exactOptional(),
        })
        .exactOptional(),
      effects: z.array(EffectSchema).exactOptional().describe("Every effect with Figma's own parameters."),
      text: z
        .object({
          lines: z.array(
            z.object({
              text: z.string(),
              break: z.enum(["line", "paragraph"]).nullable(),
            }),
          ),
          lineHeights: z.array(z.string()),
          fontSizes: z.array(z.number()),
          autoResize: z.string(),
          paragraphSpacing: z.number().exactOptional(),
        })
        .exactOptional(),
      interactions: z
        .array(
          z.object({
            trigger: z.string(),
            summary: z.string(),
            reaction: ReactionSchema,
          }),
        )
        .exactOptional(),
      component: z
        .object({
          name: z.string(),
          set: z.string().exactOptional(),
          variant: z.record(z.string(), z.string()),
        })
        .exactOptional(),
    }),
  ),
  missing: z.array(z.string()).describe("Ids that are not layers of this file."),
});
