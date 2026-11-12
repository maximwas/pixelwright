import { ComponentEntrySchema, OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

const { shape } = OPERATION_SCHEMAS.components.input;

/** The project's code for a component: the Code Connect template or batch row that connects it, and how. */
const CodeSchema = z
  .object({
    component: z.string().describe("The code component's name."),
    source: z.string().optional().describe("Its file or package, as the Code Connect file writes it."),
    missing: z.literal(true).optional().describe("The source names a file that does not exist."),
    template: z.string().describe("The template file, or the batch row as <batch file>#<n>."),
    by: z
      .enum(["key", "id", "name"])
      .describe("How it matched: the component's key, the id its url names, or the name."),
  })
  .nullable();

const LinkSchema = z.object({
  name: z.string(),
  url: z.string(),
  on: z.string().optional().describe("The variant of a set the link is on."),
  path: z.string().optional().describe("The project file a code link points at."),
});

const ListedSchema = ComponentEntrySchema.extend({
  links: z.array(LinkSchema).exactOptional(),
  code: CodeSchema,
});

/** A component as components_read lists it whole. */
export type Listed = z.output<typeof ListedSchema>;

export const ComponentsReadInputSchema = z.object({
  scope: shape.scope.describe("used: what the page (or within) uses; local: what the file defines."),
  within: shape.within.describe(
    "A layer or page id to look in. Default: the current page (used) or every page (local).",
  ),
  query: shape.query.describe('Only components whose name contains this, e.g. "icon/" for the icon sets.'),
  limit: shape.limit,
  fields: z
    .array(ListedSchema.keyof())
    .min(1)
    .exactOptional()
    .describe('Only these fields of each component, e.g. ["name", "id", "description"]. Default: all.'),
  mapped: z
    .boolean()
    .exactOptional()
    .describe("true: only components a Code Connect file connects; false: only those none connects. Default: all."),
  links: z
    .boolean()
    .default(false)
    .describe("Also read the links people attached in Dev Mode (Figma's servers, paid plans only)."),
  file: FileSchema,
});

export const ComponentsReadOutputSchema = z.object({
  components: z
    .array(ListedSchema.partial())
    .describe("Each component, with only the fields asked for when fields is given."),
  more: z.boolean(),
  notes: z.array(z.string()).optional(),
});
