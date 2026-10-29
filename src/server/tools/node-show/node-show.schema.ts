import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { NODE_SHOW_FIELD } from "@/server/tools/node-show/node-show.constants.ts";
import { SHOW } from "@/shared/ops/show/show.constants.ts";
import { showOp } from "@/shared/ops/show/show.manifest.ts";

const { node, nodes, zoom, select } = showOp.input.shape;

export const NodeShowInputSchema = zod.object({
  node: node.check(zod.describe(NODE_SHOW_FIELD.node)),
  nodes: nodes.check(zod.describe(NODE_SHOW_FIELD.nodes)),
  zoom: zod._default(zoom, SHOW.fit).check(zod.describe(NODE_SHOW_FIELD.zoom)),
  select: zod._default(select, true).check(zod.describe(NODE_SHOW_FIELD.select)),
  file: FileInputSchema,
});

export const NodeShowOutputSchema = showOp.output;

export type NodeShowInput = zod.output<typeof NodeShowInputSchema>;

export type NodeShowOutput = zod.output<typeof NodeShowOutputSchema>;
