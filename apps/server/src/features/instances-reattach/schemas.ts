import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { VersionInputSchema, VersionSavedSchema } from "../../history/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";
import { WithinSchema } from "../../plugin/scope.ts";

const shape = OPERATION_SCHEMAS.instances.input.shape;

export const InstancesReattachInputSchema = z.object({
  within: WithinSchema.exactOptional().describe(
    'Where to look: a layer id (a detached frame or what holds some), a page id, or "file". Default: the layers selected in Figma.',
  ),
  reattach: z
    .boolean()
    .exactOptional()
    .describe(
      "Put each frame detached from a component back as an instance of it. Default: true unless swap or reset is given.",
    ),
  swap: shape.swap.describe(
    'Instances of one component become another\'s: [{from: "Button", to: "Button v2"}] (names, ids or key:<key>); a set\'s variant with the same values is taken.',
  ),
  reset: shape.reset.describe(
    "Take overrides off the instances: look (fills, strokes, effects, radii, spacing; texts and sizes stay) or all.",
  ),
  dryRun: z.boolean().default(false).describe("Say what would change without writing; works with Allow edits off."),
  version: VersionInputSchema,
  file: FileSchema,
});

export const InstancesReattachOutputSchema = OPERATION_SCHEMAS.instances.output.extend({
  summary: z.string(),
  dryRun: z.boolean(),
  /** The version saved in the file's history before the write, when one was asked for. */
  version: VersionSavedSchema,
});
