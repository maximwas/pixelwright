import * as zod from "zod/mini";
import { WithinSchema } from "@/server/app/scope/scope.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { NODES_FIND_FIELD } from "@/server/tools/nodes-find/nodes-find.constants.ts";
import { FIND } from "@/shared/ops/find/find.constants.ts";
import { findOp } from "@/shared/ops/find/find.manifest.ts";
import { FoundPageSchema, FoundSchema } from "@/shared/ops/find/find.schema.ts";

const { name, type, text, textRegex, fontSize, component, componentId, variant, counts, properties, visible, limit } =
  findOp.input.shape;

/** A layer found as nodes_find answers it: within "file" with its page; with fields, only those besides id, name, type. */
const NodeFoundSchema = zod.extend(zod.partial(FoundSchema), {
  id: zod.string(),
  name: zod.string(),
  type: zod.string(),
  page: zod.exactOptional(FoundPageSchema).check(zod.describe(NODES_FIND_FIELD.foundPage)),
});

export const NodesFindInputSchema = zod.strictObject({
  name: name.check(zod.describe(NODES_FIND_FIELD.name)),
  type: type.check(zod.describe(NODES_FIND_FIELD.type)),
  text: text.check(zod.describe(NODES_FIND_FIELD.text)),
  textRegex: textRegex.check(zod.describe(NODES_FIND_FIELD.textRegex)),
  fontSize: fontSize.check(zod.describe(NODES_FIND_FIELD.fontSize)),
  component: component.check(zod.describe(NODES_FIND_FIELD.component)),
  componentId: componentId.check(zod.describe(NODES_FIND_FIELD.componentId)),
  properties: properties.check(zod.describe(NODES_FIND_FIELD.properties)),
  variant: variant.check(zod.describe(NODES_FIND_FIELD.variant)),
  counts: counts.check(zod.describe(NODES_FIND_FIELD.counts)),
  visible: visible.check(zod.describe(NODES_FIND_FIELD.visible)),
  within: zod.exactOptional(WithinSchema).check(zod.describe(NODES_FIND_FIELD.within)),
  limit: zod._default(limit, FIND.defaultLimit).check(zod.describe(NODES_FIND_FIELD.limit)),
  fields: zod
    .exactOptional(zod.array(zod.keyof(NodeFoundSchema)).check(zod.minLength(1)))
    .check(zod.describe(NODES_FIND_FIELD.fields)),
  file: FileInputSchema,
});

/** The plugin's answer, every page's merged for "file", boxes in whole px; without within, the page it searched. */
export const NodesFindOutputSchema = zod.extend(findOp.output, {
  nodes: zod.array(NodeFoundSchema),
  page: zod.exactOptional(zod.string()).check(zod.describe(NODES_FIND_FIELD.page)),
  hint: zod.exactOptional(zod.string()).check(zod.describe(NODES_FIND_FIELD.hint)),
});

export type NodesFindInput = zod.output<typeof NodesFindInputSchema>;

export type NodesFindOutput = zod.output<typeof NodesFindOutputSchema>;

export type NodeFound = zod.output<typeof NodeFoundSchema>;
