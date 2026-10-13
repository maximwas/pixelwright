import * as z from "zod";

/** One text's contrast with what is behind it. */
export const ContrastTextSchema = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string().describe("The text's first characters."),
  color: z.string(),
  backdrop: z
    .string()
    .describe('The colour behind the text, or what it is when CSS cannot say ("an image", "a gradient").'),
  ratio: z.number().nullable().describe("The WCAG contrast ratio, 1 to 21; null when the backdrop is not one colour."),
  size: z.number(),
  weight: z.number(),
  large: z.boolean().describe("Large text in WCAG terms: 24 px, or 18.66 px at weight 700 or more."),
  aa: z.boolean().nullable(),
  aaa: z.boolean().nullable(),
});

export const ContrastSchema = z.object({
  summary: z.string(),
  texts: z.array(ContrastTextSchema),
});
