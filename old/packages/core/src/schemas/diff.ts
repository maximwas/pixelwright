import * as z from "zod";

/** One layer only one of the two has: its path of names below the root, and its id. */
export const DiffOnlySchema = z.object({
  path: z.string(),
  id: z.string(),
});

/** A layer both have that differs: each side's id, the attributes as [A's, B's] (null: not set), and the drawing. */
export const DiffChangeSchema = z.object({
  path: z.string(),
  a: z.string(),
  b: z.string(),
  attributes: z.record(z.string(), z.tuple([z.string().nullable(), z.string().nullable()])),
  drawing: z
    .literal(true)
    .exactOptional()
    .describe("An icon's or image's own drawing differs: paths, colours, inner layers."),
});

/** How two layers differ as design_read reads them. */
export const DesignDiffSchema = z.object({
  same: z.boolean(),
  onlyInA: z.array(DiffOnlySchema),
  onlyInB: z.array(DiffOnlySchema),
  changed: z.array(DiffChangeSchema),
});
