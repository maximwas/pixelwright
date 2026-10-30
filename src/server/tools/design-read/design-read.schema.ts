import * as zod from "zod/mini";
import { FIT } from "@/core/design/fit/fit.constants.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import {
  DESIGN_READ_FIELD,
  DESIGN_READ_LIMITS,
  DESIGN_READ_LINE_HEIGHT,
} from "@/server/tools/design-read/design-read.constants.ts";
import { nearbyOp } from "@/shared/ops/nearby/nearby.manifest.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

const { depth } = readOp.input.shape;
const { distance } = nearbyOp.input.shape;

export const DesignReadInputSchema = zod.object({
  node: zod.exactOptional(NodeIdSchema).check(zod.describe(DESIGN_READ_FIELD.node)),
  depth: depth.check(zod.describe(DESIGN_READ_FIELD.depth)),
  screenshot: zod._default(zod.boolean(), false).check(zod.describe(DESIGN_READ_FIELD.screenshot)),
  maxChars: zod
    ._default(
      zod.int().check(zod.minimum(DESIGN_READ_LIMITS.minChars), zod.maximum(DESIGN_READ_LIMITS.maxChars)),
      FIT.maxChars,
    )
    .check(zod.describe(DESIGN_READ_FIELD.maxChars)),
  repeats: zod._default(zod.boolean(), false).check(zod.describe(DESIGN_READ_FIELD.repeats)),
  autoLineHeight: zod
    ._default(zod.enum(DESIGN_READ_LINE_HEIGHT), DESIGN_READ_LINE_HEIGHT.normal)
    .check(zod.describe(DESIGN_READ_FIELD.autoLineHeight)),
  nearby: zod.exactOptional(distance).check(zod.describe(DESIGN_READ_FIELD.nearby)),
  assetsDir: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(DESIGN_READ_LIMITS.pathChars)))
    .check(zod.describe(DESIGN_READ_FIELD.assetsDir)),
  file: FileInputSchema,
});

export type DesignReadInput = zod.output<typeof DesignReadInputSchema>;
