import * as zod from "zod/mini";

/** A layer's bounding box in page px, rounded; null for a node that has none. */
const BoxSchema = zod.object({ x: zod.number(), y: zod.number(), width: zod.number(), height: zod.number() });

/** A layer as lists name it (T-030): the id other tools take, its name, its Figma type and its box. */
const NodeRefSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  type: zod.string(),
  box: zod.nullable(BoxSchema),
});

export const SelectionOutputSchema = zod.object({ nodes: zod.array(NodeRefSchema) });

export type NodeRef = zod.output<typeof NodeRefSchema>;
