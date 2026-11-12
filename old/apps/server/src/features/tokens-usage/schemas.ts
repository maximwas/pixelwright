import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const TokensUsageInputSchema = z.object({
  token: OPERATION_SCHEMAS.usage.input.shape.token.describe(
    "A style's or variable's token as design_read or tokens_read writes it: --White-2, --h1-font, --color-bg.",
  ),
  within: OPERATION_SCHEMAS.usage.input.shape.within.describe(
    'The layer or page to look in, or "file" for every page (loading them all is slow on a big file). Default: the current page.',
  ),
  file: FileSchema,
});
