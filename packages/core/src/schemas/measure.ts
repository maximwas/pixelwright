import * as z from "zod";

const LayerRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const SidesSchema = z.object({
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number(),
});

/** How one layer sits against the one before it in the list. */
export const MeasuredPairSchema = z.object({
  a: LayerRefSchema,
  b: LayerRefSchema,
  summary: z.string(),
  gap: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .describe("The space between the two boxes on each axis, in px; negative where they overlap on that axis."),
  edges: z
    .object({
      left: z.number(),
      right: z.number(),
      top: z.number(),
      bottom: z.number(),
      centerX: z.number(),
      centerY: z.number(),
    })
    .describe("B's edge minus A's, in px: 0 is aligned, positive is further right or lower."),
  contains: z.enum(["a", "b"]).exactOptional().describe("Which of the two holds the other within its box."),
  inset: SidesSchema.exactOptional().describe("How far the inner box sits from each edge of the outer one."),
});

export const MeasureSchema = z.object({
  measured: z.enum(["box", "painted"]).describe("The layout boxes, or what is painted (strokes and shadows included)."),
  pairs: z.array(MeasuredPairSchema),
  missing: z.array(z.string()).describe("Ids that are not layers of this file."),
});
