import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { INSPECT_INPUT } from "@/server/tools/inspect/inspect.constants.ts";
import { inspectOp } from "@/shared/ops/inspect/inspect.manifest.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

const { nodes, relativeTo, within, depth, fields } = inspectOp.input.shape;

export const InspectInputSchema = zod.strictObject({
  nodes: zod.exactOptional(nodes).check(zod.describe(INSPECT_INPUT.nodes)),
  within: within.check(zod.describe(INSPECT_INPUT.within)),
  depth: depth.check(zod.describe(INSPECT_INPUT.depth)),
  fields: fields.check(zod.describe(INSPECT_INPUT.fields)),
  relativeTo: relativeTo.check(zod.describe(INSPECT_INPUT.relativeTo)),
  around: zod
    .exactOptional(zod.union([NodeIdSchema, zod.strictObject({ x: zod.number(), y: zod.number() })]))
    .check(zod.describe(INSPECT_INPUT.around)),
  file: FileInputSchema,
});

export type InspectToolInput = zod.output<typeof InspectInputSchema>;
