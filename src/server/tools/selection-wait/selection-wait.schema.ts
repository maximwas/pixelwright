import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import {
  SELECTION_WAIT_FIELD,
  SELECTION_WAIT_SECONDS,
} from "@/server/tools/selection-wait/selection-wait.constants.ts";
import { SelectionOutputSchema } from "@/shared/ops/selection/selection.schema.ts";

export const SelectionWaitInputSchema = zod.object({
  timeout: zod
    ._default(
      zod.number().check(zod.minimum(SELECTION_WAIT_SECONDS.min), zod.maximum(SELECTION_WAIT_SECONDS.max)),
      SELECTION_WAIT_SECONDS.default,
    )
    .check(zod.describe(SELECTION_WAIT_FIELD.timeout)),
  file: FileInputSchema,
});

export const SelectionWaitOutputSchema = zod.object({
  changed: zod.boolean().check(zod.describe(SELECTION_WAIT_FIELD.changed)),
  nodes: SelectionOutputSchema.shape.nodes.check(zod.describe(SELECTION_WAIT_FIELD.nodes)),
});

export type SelectionWaitInput = zod.output<typeof SelectionWaitInputSchema>;

export type SelectionWaitOutput = zod.output<typeof SelectionWaitOutputSchema>;
