import * as zod from "zod/mini";
import { DEV_STATUS, OUTLINE } from "@/shared/ops/outline/outline.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** The layer or page to outline, or 0:0 for the pages, the current page when left out; how many levels to list. */
export const OutlineOpInputSchema = zod.strictObject({
  node: zod.exactOptional(NodeIdSchema),
  depth: zod.int().check(zod.minimum(OUTLINE.minDepth), zod.maximum(OUTLINE.maxDepth)),
});

/**
 * A layer as the outline lists it (T-044): its metadata, its box relative to the outlined node in px as Figma gives it
 * (the server rounds it, D-15), how many children it has and those listed.
 */
const OutlineNodeSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  type: zod.string(),
  component: zod.exactOptional(zod.string()),
  variant: zod.exactOptional(zod.string()),
  x: zod.exactOptional(zod.number()),
  y: zod.exactOptional(zod.number()),
  width: zod.exactOptional(zod.number()),
  height: zod.exactOptional(zod.number()),
  hidden: zod.exactOptional(zod.literal(true)),
  dev: zod.exactOptional(zod.enum(DEV_STATUS)),
  childCount: zod.exactOptional(zod.number()),
  get children() {
    return zod.exactOptional(zod.array(OutlineNodeSchema));
  },
});

export const OutlineOpOutputSchema = zod.object({ root: OutlineNodeSchema });

export type OutlineNode = zod.output<typeof OutlineNodeSchema>;
