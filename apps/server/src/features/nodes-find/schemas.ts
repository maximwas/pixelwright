import { OPERATION_SCHEMAS } from "@pixelwright/core";
import { FileSchema } from "../../plugin/file-schema.ts";
import { WithinSchema } from "../../plugin/scope.ts";

export const NodesFindInputSchema = OPERATION_SCHEMAS.find.input.extend({
  within: WithinSchema.exactOptional().describe(
    'Where to search: a layer or page id, or "file" for every page. Default: the current page.',
  ),
  file: FileSchema,
});

export const NodesFindOutputSchema = OPERATION_SCHEMAS.find.output;
