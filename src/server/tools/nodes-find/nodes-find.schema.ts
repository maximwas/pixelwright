import * as zod from "zod/mini";
import { WithinSchema } from "@/server/app/scope/scope.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { NODES_FIND_FIELD } from "@/server/tools/nodes-find/nodes-find.constants.ts";
import { FIND } from "@/shared/ops/find/find.constants.ts";
import { findOp } from "@/shared/ops/find/find.manifest.ts";

const { name, type, text, component, variant, counts, visible, limit } = findOp.input.shape;

export const NodesFindInputSchema = zod.strictObject({
  name,
  type,
  text,
  component,
  variant: variant.check(zod.describe(NODES_FIND_FIELD.variant)),
  counts: counts.check(zod.describe(NODES_FIND_FIELD.counts)),
  visible: visible.check(zod.describe(NODES_FIND_FIELD.visible)),
  within: zod.exactOptional(WithinSchema).check(zod.describe(NODES_FIND_FIELD.within)),
  limit: zod._default(limit, FIND.defaultLimit),
  file: FileInputSchema,
});

/** The plugin's answer, every page's merged for "file", boxes in whole px; without within, the page it searched. */
export const NodesFindOutputSchema = zod.extend(findOp.output, {
  page: zod.exactOptional(zod.string()).check(zod.describe(NODES_FIND_FIELD.page)),
  hint: zod.exactOptional(zod.string()).check(zod.describe(NODES_FIND_FIELD.hint)),
});

export type NodesFindInput = zod.output<typeof NodesFindInputSchema>;

export type NodesFindOutput = zod.output<typeof NodesFindOutputSchema>;
