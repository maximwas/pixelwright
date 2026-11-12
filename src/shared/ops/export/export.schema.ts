import * as zod from "zod/mini";
import { EXPORT_FORMAT, EXPORT_SCALE, EXPORT_STREAM } from "@/shared/ops/export/export.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** Pixels per Figma pixel. */
export const ExportScaleSchema = zod.number().check(zod.minimum(EXPORT_SCALE.min), zod.maximum(EXPORT_SCALE.max));

/** The server's id of one export: its chunks are read under it, and no other export shares its render (T-075). */
export const StreamIdSchema = zod.string().check(zod.minLength(1), zod.maxLength(EXPORT_STREAM.idChars));

/**
 * One layer rendered (T-070): in a format, at a scale, with its effects (what paints around its box) or its box alone,
 * the scale lowered so the longer side fits maxSide when given; the plugin holds the bytes under the stream for chunk.
 */
export const ExportInputSchema = zod.strictObject({
  node: NodeIdSchema,
  format: zod.enum(EXPORT_FORMAT),
  scale: ExportScaleSchema,
  effects: zod.boolean(),
  maxSide: zod.exactOptional(zod.int().check(zod.positive())),
  stream: StreamIdSchema,
});

/** The scale the layer was rendered at (lower than asked when it had to fit maxSide), and how many bytes it holds. */
export const ExportOutputSchema = zod.object({ scale: zod.number(), totalBytes: zod.int().check(zod.nonnegative()) });
