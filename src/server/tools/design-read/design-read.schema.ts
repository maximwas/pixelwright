import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { DESIGN_READ_FIELD } from "@/server/tools/design-read/design-read.constants.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

const { depth } = readOp.input.shape;

export const DesignReadInputSchema = zod.object({
  node: zod.exactOptional(NodeIdSchema).check(zod.describe(DESIGN_READ_FIELD.node)),
  depth: depth.check(zod.describe(DESIGN_READ_FIELD.depth)),
  file: FileInputSchema,
});

export type DesignReadInput = zod.output<typeof DesignReadInputSchema>;
