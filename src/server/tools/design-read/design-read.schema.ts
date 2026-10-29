import * as zod from "zod/mini";
import { FIT } from "@/core/design/fit/fit.constants.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { DESIGN_READ_FIELD, DESIGN_READ_LIMITS } from "@/server/tools/design-read/design-read.constants.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

const { depth } = readOp.input.shape;

export const DesignReadInputSchema = zod.object({
  node: zod.exactOptional(NodeIdSchema).check(zod.describe(DESIGN_READ_FIELD.node)),
  depth: depth.check(zod.describe(DESIGN_READ_FIELD.depth)),
  maxChars: zod
    ._default(
      zod.int().check(zod.minimum(DESIGN_READ_LIMITS.minChars), zod.maximum(DESIGN_READ_LIMITS.maxChars)),
      FIT.maxChars,
    )
    .check(zod.describe(DESIGN_READ_FIELD.maxChars)),
  repeats: zod._default(zod.boolean(), false).check(zod.describe(DESIGN_READ_FIELD.repeats)),
  file: FileInputSchema,
});

export type DesignReadInput = zod.output<typeof DesignReadInputSchema>;
