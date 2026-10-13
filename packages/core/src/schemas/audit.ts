import * as z from "zod";

const UseSchema = z.object({
  value: z.number(),
  count: z.number(),
  token: z.string().exactOptional().describe("The variable these uses are bound to."),
});

/** The design's scale as a layer uses it, and what is off it. */
export const DesignAuditSchema = z.object({
  summary: z.string(),
  spacing: z.array(UseSchema).describe("Gaps and paddings in px, smallest first."),
  radii: z.array(UseSchema),
  fontSizes: z.array(UseSchema),
  lineHeights: z.array(
    z.object({
      value: z.string(),
      count: z.number(),
    }),
  ),
  colors: z
    .array(
      z.object({
        value: z.string(),
        count: z.number(),
        token: z.string().exactOptional().describe("The style or variable these uses are bound to."),
      }),
    )
    .describe("Fills, strokes and text colours, most used first; bound uses apart from raw ones."),
  notes: z.array(z.string()),
});
