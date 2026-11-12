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
  root: z.string().describe("The project folder the Code Connect files were looked for in."),
  templates: z.array(
    z.object({
      path: z
        .string()
        .describe("A template file, a batch row (<batch file>#<n>), or a batch file none of whose rows is used here."),
      url: z.string().optional(),
      key: z.string().optional(),
      component: z.string().optional(),
      source: z.string().optional().describe("The code component's file or package, as written."),
      missing: z.literal(true).optional().describe("The source names a file that does not exist."),
      matches: z.array(
        ComponentCountSchema.extend({
          by: z
            .enum(["key", "id", "name"])
            .describe("How it matched: the component's key, the id its url names, or the name."),
        }),
      ),
      error: z.string().optional().describe("What a trial run on the first instance it matches gave."),
      unread: z
        .array(z.string())
        .optional()
        .describe(
          "Properties of that instance its code never reads: its own (Description), a nested one's (Button.Label).",
        ),
      values: z
        .record(z.string(), z.array(z.string()))
        .optional()
        .describe("Variant values its getEnum mappings miss, by property: Figma renders them as undefined."),
    }),
  ),
  unconnected: z
    .array(
      ComponentCountSchema.extend({
        id: z.string().describe("The component's or set's id."),
        key: z.string().optional().describe("The key a batch row or // key= needs; a set's for a variant."),
        remote: z.literal(true).optional().describe("It comes from a library."),
      }),
    )
    .describe("Components shown here as layers that no Code Connect file connects."),
  problems: z.array(z.string()),
});
