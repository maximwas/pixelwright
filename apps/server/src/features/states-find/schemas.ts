import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";
import { WithinSchema } from "../../plugin/scope.ts";

export const StatesFindInputSchema = z.object({
  within: WithinSchema.exactOptional().describe(
    'Where to look: a layer id, a page id, or "file" (the file\'s own components). Default: the layers selected in Figma, else the current page.',
  ),
  file: FileSchema,
});
