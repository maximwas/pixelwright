import * as zod from "zod/mini";
import { SHOW } from "@/shared/ops/show/show.constants.ts";

/** A layer's id as tools take it, e.g. 54:243. */
export const NodeIdSchema = zod.string().check(zod.minLength(1), zod.maxLength(SHOW.idChars));

/** One layer or several on one page; the zoom that fits them, or a zoom (1 is 100%) centred on them; select or not. */
export const ShowInputSchema = zod.strictObject({
  node: zod.exactOptional(NodeIdSchema),
  nodes: zod.exactOptional(zod.array(NodeIdSchema).check(zod.minLength(1), zod.maxLength(SHOW.maxNodes))),
  zoom: zod.union([zod.literal(SHOW.fit), zod.number().check(zod.minimum(SHOW.minZoom), zod.maximum(SHOW.maxZoom))]),
  select: zod.boolean(),
});

/** The layers shown, the page they are on, and the zoom the view ended at. */
export const ShowOutputSchema = zod.object({
  nodes: zod.array(zod.object({ id: zod.string(), name: zod.string() })),
  page: zod.string(),
  zoom: zod.number(),
});
