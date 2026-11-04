import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { OUTLINE_FIELD } from "@/server/tools/outline/outline.constants.ts";
import { OUTLINE } from "@/shared/ops/outline/outline.constants.ts";
import { outlineOp } from "@/shared/ops/outline/outline.manifest.ts";

const { node, depth } = outlineOp.input.shape;

export const OutlineInputSchema = zod.strictObject({
  node: node.check(zod.describe(OUTLINE_FIELD.node)),
  depth: zod._default(depth, OUTLINE.defaultDepth).check(zod.describe(OUTLINE_FIELD.depth)),
  file: FileInputSchema,
});

/** The outline as light XML, and how many layers it lists. */
export const OutlineOutputSchema = zod.object({
  xml: zod.string(),
  nodes: zod.number().check(zod.describe(OUTLINE_FIELD.nodes)),
});

export type OutlineInput = zod.output<typeof OutlineInputSchema>;

export type OutlineOutput = zod.output<typeof OutlineOutputSchema>;
