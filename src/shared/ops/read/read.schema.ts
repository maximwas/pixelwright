import * as zod from "zod/mini";
import { CUT_REASON } from "@/shared/envelope/op-result.constants.ts";
import { READ } from "@/shared/ops/read/read.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";
import { ReadModelSchema, ReadPageSchema } from "@/shared/read-model/read-model.schema.ts";

/**
 * The layers to read, each with its descendants to `depth` levels below it (all when left out); asked for, a vector's
 * paths as a hash (the tools that tell two drawings apart) and each root's layers above it (the tools that place a
 * layer in its parent).
 */
export const ReadOpInputSchema = zod.strictObject({
  nodes: zod.array(NodeIdSchema).check(zod.minLength(1)),
  depth: zod.exactOptional(zod.int().check(zod.minimum(READ.minDepth), zod.maximum(READ.maxDepth))),
  pathHash: zod.exactOptional(zod.boolean()),
  ancestors: zod.exactOptional(zod.boolean()),
});

/** A layer whose children the read did not list in full (K-034): `depth` stopped there, or the budget ran out. */
const ReadCutSchema = zod.strictObject({ id: zod.string(), reason: zod.enum(CUT_REASON) });

/**
 * A read model per layer found, in the order asked (A§7.1), each naming its layer's page (T-206: a baseline keeps it
 * and looks for a remade root there); the ids Figma did not give (P-070); every cut, so a reader need not count
 * children against childCount to find them (m:ec973ea3).
 */
export const ReadOpOutputSchema = zod.strictObject({
  reads: zod.array(zod.extend(ReadModelSchema, { page: ReadPageSchema })),
  missing: zod.array(zod.string()),
  cuts: zod.array(ReadCutSchema),
});

export type ReadCut = zod.output<typeof ReadCutSchema>;
