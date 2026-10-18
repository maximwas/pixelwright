import { ApplyErrorSchema, ApplyResultSchema } from "@pixelwright/core";
import * as z from "zod";
import { VersionInputSchema, VersionSavedSchema } from "../../history/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";

export const DesignApplyInputSchema = z.object({
  xml: z
    .string()
    .min(1)
    .max(2_000_000)
    .describe(
      "Pixelwright XML, as design_read writes it: an element with id changes that layer (only the attributes it gives), one without id creates a layer.",
    ),
  parent: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("Where top-level new layers go: a frame's or page's id. Default: the current page, beside its layers."),
  dryRun: z
    .boolean()
    .default(false)
    .describe(
      "Check ids, tokens and fonts without writing, listing the layers it would create (without ids) and change; works with Allow edits off.",
    ),
  version: VersionInputSchema,
  file: FileSchema,
});

export const DesignApplyOutputSchema = ApplyResultSchema.extend({
  errors: z.array(ApplyErrorSchema),
  dryRun: z.boolean(),
  /** The version saved in the file's history before the write, when one was asked for. */
  version: VersionSavedSchema,
});
