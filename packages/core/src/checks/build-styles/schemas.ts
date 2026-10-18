import * as z from "zod";

/** A build's computed styles for one layer against what the design sets. */
export const StyleComparisonSchema = z.object({
  matched: z.number().int().describe("Properties the build has as the design sets them."),
  mismatches: z
    .array(
      z.object({
        property: z.string(),
        design: z.string().describe("The design's value, its tokens' values in."),
        from: z
          .string()
          .exactOptional()
          .describe('What the design takes it from: a token, var(--name), or a text style, textStyle="Name".'),
        build: z.string().describe("The build's computed value."),
      }),
    )
    .describe("Properties the build has otherwise, in the design's order."),
  notGiven: z
    .array(z.string())
    .describe("Properties the design sets that the build's styles leave out: read them too and compare again."),
  notCompared: z
    .array(
      z.object({
        property: z.string(),
        design: z.string(),
      }),
    )
    .describe(
      "What the design writes in a way a computed style cannot be held against: an offset in percent or calc(), tracks in fr, a value in em without a font size.",
    ),
});

export type StyleComparison = z.output<typeof StyleComparisonSchema>;
