import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const CodeConnectReadInputSchema = z.object({
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe("A layer or page id to look in, e.g. 54:243. Default: the current page."),
  file: FileSchema,
});

const ComponentCountSchema = z.object({
  component: z.string().describe("The Figma component's (or component set's) name."),
  instances: z.number(),
});

export const CodeConnectReadOutputSchema = z.object({
  root: z.string().describe("The project folder the templates were looked for in."),
  templates: z.array(
    z.object({
      path: z.string(),
      url: z.string().optional(),
      component: z.string().optional(),
      matches: z.array(ComponentCountSchema),
      error: z.string().optional().describe("What a trial run on the first instance it matches gave."),
    }),
  ),
  unconnected: z.array(ComponentCountSchema).describe("Components used here that no template connects."),
  problems: z.array(z.string()),
});
