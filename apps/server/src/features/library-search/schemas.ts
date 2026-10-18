import { ComponentEntrySchema } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";
import { SEARCH_LIMIT_MAX } from "./constants.ts";

/** A published component or set as a library's catalogue keeps it. */
export const LibraryComponentSchema = ComponentEntrySchema.pick({
  key: true,
  type: true,
  name: true,
  page: true,
  description: true,
  properties: true,
});

/** A library file's catalogue, one JSON file in ~/.pixelwright/libraries. */
export const LibraryFileSchema = z.object({
  pixelwrightLibrary: z.literal(1),
  /** The library file's name in Figma. */
  name: z.string(),
  /** figma.fileKey, which only private plugins get. */
  key: z.string().nullable(),
  savedAt: z.iso.datetime(),
  components: z.array(LibraryComponentSchema),
});

export const LibrarySearchInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe(
      "Words to find in the components' names, descriptions, pages and variants, in any order (button hover); a typo still finds. Left out, the saved libraries are listed.",
    ),
  save: z
    .boolean()
    .default(false)
    .describe(
      "Save the file's own published components as a library first, replacing what was saved for it before: call it in the library file, open in Figma Desktop with the Pixelwright plugin.",
    ),
  file: FileSchema,
  limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).default(20).describe("The most components to give."),
});

export const LibrarySearchOutputSchema = z.object({
  components: z
    .array(
      LibraryComponentSchema.omit({ key: true }).extend({
        library: z.string(),
        component: z.string().describe('design_apply\'s <Instance component="key:…">.'),
      }),
    )
    .exactOptional()
    .describe("What the query found, best first."),
  more: z.boolean().exactOptional(),
  saved: z
    .object({
      library: z.string(),
      path: z.string(),
      components: z.number().int(),
    })
    .exactOptional(),
  libraries: z
    .array(
      z.object({
        name: z.string(),
        components: z.number().int(),
        savedAt: z.string(),
        path: z.string(),
      }),
    )
    .describe("Every saved library."),
  notes: z.array(z.string()).exactOptional(),
});
