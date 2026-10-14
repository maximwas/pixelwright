import { TokensApplyInputSchema, TokensApplyResultSchema } from "@pixelwright/core";
import * as z from "zod";
import { VersionInputSchema, VersionSavedSchema } from "../../history/schemas.ts";
import { FileSchema } from "../../schemas/tools.ts";

export const TokensApplyToolInputSchema = TokensApplyInputSchema.extend({
  dryRun: z
    .boolean()
    .default(false)
    .describe("Check names, types, modes and aliases without writing; works with Allow edits off."),
  version: VersionInputSchema,
  file: FileSchema,
});

export const TokensApplyOutputSchema = TokensApplyResultSchema.extend({
  dryRun: z.boolean(),
  /** The version saved in the file's history before the write, when one was asked for. */
  version: VersionSavedSchema,
});
