import * as zod from "zod/mini";
import { DesignDiffSchema } from "@/core/diff/diff.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { NODES_DIFF_FIELD } from "@/server/tools/nodes-diff/nodes-diff.constants.ts";
import { READ } from "@/shared/ops/read/read.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** 0.7.0's input (T-085): the two layers, how deep to compare, the file. */
export const NodesDiffInputSchema = zod.object({
  a: NodeIdSchema.check(zod.describe(NODES_DIFF_FIELD.a)),
  b: NodeIdSchema.check(zod.describe(NODES_DIFF_FIELD.b)),
  depth: zod
    .exactOptional(zod.int().check(zod.minimum(READ.minDepth), zod.maximum(READ.maxDepth)))
    .check(zod.describe(NODES_DIFF_FIELD.depth)),
  file: FileInputSchema,
});

export const NodesDiffOutputSchema = zod.strictObject({
  ...DesignDiffSchema.shape,
  summary: zod.string(),
  more: zod.exactOptional(zod.int()).check(zod.describe(NODES_DIFF_FIELD.more)),
});

export type NodesDiffInput = zod.output<typeof NodesDiffInputSchema>;
export type NodesDiffAnswer = zod.output<typeof NodesDiffOutputSchema>;
