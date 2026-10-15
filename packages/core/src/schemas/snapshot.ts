import * as z from "zod";
import type { SnapshotNode } from "../types/snapshot.ts";
import { SnapshotFieldsSchema } from "./snapshot-fields.ts";
import { FontNameSchema, LetterSpacingSchema, LineHeightSchema } from "./snapshot-text.ts";
import { EffectSchema, PaintSchema } from "./snapshot-values.ts";

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
  /** Figma's colour profile of the file (LEGACY, SRGB, DISPLAY_P3): a Display P3 file's colours are P3 values. */
  colorProfile: z.string().optional(),
  /** What the designer marked in Dev Mode on the read layer or the nearest layer above it: ready, or completed. */
  devStatus: z.enum(["ready", "completed"]).optional(),
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
  /** The page the read layer is on; plugins before stage 11 leave it out. */
  page: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
});
