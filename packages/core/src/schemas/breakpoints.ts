import * as z from "zod";

/** A screen as breakpoints_find compares it: its size and its children's names. */
export const ScreenSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  children: z.array(z.string()),
});

/** The screen asked about and the page's others, as the plugin reads them. */
export const ScreensRawSchema = z.object({
  target: ScreenSchema,
  screens: z.array(ScreenSchema),
});

export const BreakpointsSchema = z.object({
  summary: z.string(),
  widths: z
    .array(
      ScreenSchema.omit({ children: true }).extend({
        score: z.number().describe("How alike the two are, 0 to 1: names without size words, and shared children."),
        this: z.literal(true).exactOptional().describe("The screen asked about."),
      }),
    )
    .describe("The screen at each width, narrowest first."),
});
