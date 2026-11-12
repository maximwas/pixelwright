import * as zod from "zod/mini";
import { BoxSchema, NodeRefSchema } from "@/shared/ops/selection/selection.schema.ts";

/** What the user sees (T-033, P-113): the page, the zoom, the view's centre and bounds, the layers that meet it. */
export const ViewportOutputSchema = zod.object({
  page: zod.string(),
  zoom: zod.number(),
  center: zod.object({ x: zod.number(), y: zod.number() }),
  /** The part of the page in view, in page px. */
  bounds: BoxSchema,
  /** The page's layers and their children that meet the view, outermost first. */
  layers: zod.array(NodeRefSchema),
  /** More layers meet the view than the answer lists. */
  more: zod.boolean(),
});
