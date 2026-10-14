import * as z from "zod";
import { SnapshotStyleSchema, SnapshotVariableSchema } from "./snapshot.ts";
import { SnapshotFieldsSchema } from "./snapshot-fields.ts";
import { EffectSchema, ReactionSchema } from "./snapshot-values.ts";

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
  /** The styles and variables the layers use, as a snapshot gives them. */
  styles: z.record(z.string(), SnapshotStyleSchema).optional(),
  variables: z.record(z.string(), SnapshotVariableSchema).optional(),
  /** Figma's colour profile of the file: a Display P3 file's colours are P3 values. */
  colorProfile: z.string().optional(),
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
      fills: z
        .object({
          css: z
            .string()
            .describe("The fill as a CSS value, top paint first: a colour, a gradient as Figma writes it."),
          style: z
            .object({
              name: z.string(),
              token: z.string(),
            })
            .exactOptional()
            .describe("The paint style it comes from, and the token design_read names it by."),
          tokens: z
            .record(z.string(), z.string())
            .exactOptional()
            .describe("The variables the paints are bound to, by token, with their values."),
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
  left: z.number().int().exactOptional().describe("Layers asked for past the first 100, not read: inspect them next."),
});
