import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { VersionInputSchema, VersionSavedSchema } from "../../history/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";
import { WithinSchema } from "../../plugin/scope.ts";

const shape = OPERATION_SCHEMAS.bind.input.shape;

export const TokensBindInputSchema = z.object({
  within: WithinSchema.exactOptional().describe(
    'The layers to bind in: a layer id, a page id (all its layers), or "file". Default: the layers selected in Figma.',
  ),
  kinds: shape.kinds.describe(
    "What to bind: color (fills, strokes, text colours), number (gaps, padding, radii, border widths, opacity), text (text styles), effect (effect styles). Default: all.",
  ),
  choose: shape.choose.describe(
    "Picks: for a value several tokens hold, the one it takes; or a value to snap to a token (a near colour, an off-scale gap), which then takes the token's value. Values as this tool lists them.",
  ),
  remap: shape.remap.describe(
    "Rebind every use of one token to another of its kind (--blue-500 to --brand, a duplicate style to the one kept); raw values are then left alone.",
  ),
  instances: shape.instances.describe(
    "With remap: leave (default) keeps instances to their main components; override rebinds the uses inside them, nested instances too, as overrides on each instance, for a copy that must differ from its components (a dark copy in a file whose plan has one mode).",
  ),
  dryRun: z.boolean().default(false).describe("List what would be bound without writing; works with Allow edits off."),
  version: VersionInputSchema,
  file: FileSchema,
});

export const TokensBindOutputSchema = OPERATION_SCHEMAS.bind.output.extend({
  summary: z.string(),
  dryRun: z.boolean(),
  /** The version saved in the file's history before the write, when one was asked for. */
  version: VersionSavedSchema,
});
