import * as zod from "zod/mini";
import { StreamIdSchema } from "@/shared/ops/export/export.schema.ts";
import { IMAGE_HASH } from "@/shared/ops/image/image.constants.ts";

/** An image fill's original bytes by its hash (T-055, T-194): the plugin holds them under the stream for chunk. */
export const ImageInputSchema = zod.strictObject({
  hash: zod.string().check(zod.minLength(1), zod.maxLength(IMAGE_HASH.chars)),
  stream: StreamIdSchema,
});

/** How many bytes the image holds. */
export const ImageOutputSchema = zod.object({ totalBytes: zod.int().check(zod.nonnegative()) });
