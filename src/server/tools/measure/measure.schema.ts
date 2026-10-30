import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { MEASURE, MEASURE_INPUT } from "@/server/tools/measure/measure.constants.ts";
import { INSPECT } from "@/shared/ops/inspect/inspect.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

export const MeasureInputSchema = zod.object({
  nodes: zod
    .exactOptional(zod.array(NodeIdSchema).check(zod.minLength(MEASURE.minLayers), zod.maxLength(INSPECT.maxLayers)))
    .check(zod.describe(MEASURE_INPUT.nodes)),
  painted: zod._default(zod.boolean(), false).check(zod.describe(MEASURE_INPUT.painted)),
  file: FileInputSchema,
});

export type MeasureInput = zod.output<typeof MeasureInputSchema>;
