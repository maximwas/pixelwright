import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { VersionInputSchema, VersionSavedSchema } from "../../history/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";
import { WithinSchema } from "../../plugin/scope.ts";

export const TextsReplaceInputSchema = z.object({
  within: WithinSchema.exactOptional().describe(
    'The texts to change: under a layer id, a page id, or "file". Default: under the layers selected in Figma.',
  ),
  replacements: OPERATION_SCHEMAS.texts.input.shape.replacements.describe(
    "What to replace with what: one pair, or a list (copy edits, a translation), all made at once against the text as it was, so one pair never feeds another; where matches overlap the earliest wins, then the longest.",
  ),
  dryRun: z.boolean().default(false).describe("List the texts that would change, before and after, without writing."),
  version: VersionInputSchema,
  file: FileSchema,
});

export const TextsReplaceOutputSchema = OPERATION_SCHEMAS.texts.output.extend({
  summary: z.string(),
  dryRun: z.boolean(),
  /** The version saved in the file's history before the write, when one was asked for. */
  version: VersionSavedSchema,
});
