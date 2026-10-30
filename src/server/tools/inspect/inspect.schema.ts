import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { INSPECT_INPUT } from "@/server/tools/inspect/inspect.constants.ts";
import { inspectOp } from "@/shared/ops/inspect/inspect.manifest.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

const { nodes, relativeTo } = inspectOp.input.shape;

export const InspectInputSchema = zod.object({
  nodes: zod.exactOptional(nodes).check(zod.describe(INSPECT_INPUT.nodes)),
  relativeTo: relativeTo.check(zod.describe(INSPECT_INPUT.relativeTo)),
  around: zod
    .exactOptional(zod.union([NodeIdSchema, zod.object({ x: zod.number(), y: zod.number() })]))
    .check(zod.describe(INSPECT_INPUT.around)),
  file: FileInputSchema,
});

export type InspectToolInput = zod.output<typeof InspectInputSchema>;
