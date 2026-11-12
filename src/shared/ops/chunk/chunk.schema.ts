import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { StreamIdSchema } from "@/shared/ops/export/export.schema.ts";

/** A part of an export the plugin holds: from offset, at most length bytes, one frame's worth (T-075, S-006). */
export const ChunkInputSchema = zod.strictObject({
  stream: StreamIdSchema,
  offset: zod.int().check(zod.nonnegative()),
  length: zod.int().check(zod.positive(), zod.maximum(LIMITS.exportChunkBytes)),
});

/** The export's whole size, and the part as base64. */
export const ChunkOutputSchema = zod.object({ totalBytes: zod.int().check(zod.nonnegative()), bytes: zod.string() });
