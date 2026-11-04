import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { FLOW_READ_FIELD } from "@/server/tools/flow-read/flow-read.constants.ts";
import { FlowScreenSchema } from "@/shared/ops/flows/flows.schema.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** 0.7.0's input (T-088): the page, the current one by default, and the file. */
export const FlowReadInputSchema = zod.object({
  page: zod.exactOptional(NodeIdSchema).check(zod.describe(FLOW_READ_FIELD.page)),
  file: FileInputSchema,
});

/** One interaction that leaves its layer: from which screen and layer, on what, to where, and how, in words. */
const FlowLinkSchema = zod.strictObject({
  from: zod.strictObject({ id: zod.string(), name: zod.string() }),
  layer: zod.strictObject({ id: zod.string(), name: zod.string() }),
  trigger: zod.string(),
  action: zod.string(),
  to: zod.nullable(zod.strictObject({ id: zod.string(), name: zod.string() })),
  url: zod.exactOptional(zod.string()),
  summary: zod.string(),
});

export const FlowReadOutputSchema = zod.strictObject({
  page: zod.string(),
  starts: zod.array(zod.strictObject({ id: zod.string(), name: zod.string() })),
  screens: zod.array(FlowScreenSchema),
  links: zod.array(FlowLinkSchema),
  more: zod.boolean(),
});

export type FlowReadInput = zod.output<typeof FlowReadInputSchema>;
export type FlowMap = zod.output<typeof FlowReadOutputSchema>;
export type FlowLink = zod.output<typeof FlowLinkSchema>;
