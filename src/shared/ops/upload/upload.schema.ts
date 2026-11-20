import * as zod from "zod/mini";
import { StreamIdSchema } from "@/shared/ops/export/export.schema.ts";
import { UPLOAD } from "@/shared/ops/upload/upload.constants.ts";

/** A part of a file on its way in (P-030): its bytes as base64 from offset, of a file of total bytes. */
export const UploadInputSchema = zod.strictObject({
  stream: StreamIdSchema,
  offset: zod.int().check(zod.nonnegative()),
  chunk: zod.string(),
  total: zod.int().check(zod.positive(), zod.maximum(UPLOAD.maxBytes)),
});

/** How many of the file's bytes have come so far. */
export const UploadOutputSchema = zod.object({ received: zod.int().check(zod.nonnegative()) });
