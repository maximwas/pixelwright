import * as z from "zod";
import { VersionInputSchema, VersionSavedSchema } from "../../history/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";
import { ICON_DEFAULT_SIZE, ICON_SEARCH_MAX } from "./constants.ts";

/** An Iconify name part: a set's prefix or an icon's name, lower case words joined by dashes. */
const NAME_PART = "[a-z0-9]+(?:-[a-z0-9]+)*";

/** A layer's id, as design_apply takes its parent. */
const LayerIdSchema = z.string().min(1).max(200);

export const IconsInsertInputSchema = z.object({
  search: z
    .string()
    .min(1)
    .max(100)
    .exactOptional()
    .describe("Words to look for, e.g. arrow right: lists icons with their set and licence, and writes nothing."),
  set: z
    .string()
    .regex(new RegExp(`^${NAME_PART}$`))
    .exactOptional()
    .describe("Only this set's icons in a search, by its prefix: lucide, mdi, tabler, ph, material-symbols…"),
  limit: z.number().int().min(1).max(ICON_SEARCH_MAX).default(20).describe("Icons a search lists, 20 by default."),
  icon: z
    .string()
    .regex(new RegExp(`^${NAME_PART}:${NAME_PART}$`), "An icon is set:name, as search lists it: lucide:arrow-right.")
    .exactOptional()
    .describe("The icon to insert, as search lists it: lucide:arrow-right."),
  parent: LayerIdSchema.exactOptional().describe("The frame to put it in. Default: the current page."),
  before: LayerIdSchema.exactOptional().describe("A layer of the parent to put it before; default: after the last."),
  size: z
    .number()
    .min(1)
    .max(1_024)
    .default(ICON_DEFAULT_SIZE)
    .describe("Its height in px, 24 by default; its width follows the icon's proportions."),
  color: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe(
      "A CSS colour, or var(--token) to bind it to that colour variable. An icon of a set drawn in its own colours keeps them.",
    ),
  name: z.string().min(1).max(200).exactOptional().describe("The layer's name; default: the icon's."),
  dryRun: z.boolean().default(false).describe("Check the icon and where it goes without making the layer."),
  version: VersionInputSchema,
  file: FileSchema,
});

const LicenseSchema = z.object({
  set: z.string(),
  title: z.string(),
  spdx: z.string().exactOptional(),
  url: z.string().exactOptional(),
});

export const IconsInsertOutputSchema = z.object({
  icons: z
    .array(
      z.object({
        icon: z.string(),
        set: z.string(),
        license: z.string(),
      }),
    )
    .exactOptional()
    .describe("A search's icons, set:name, with their set and its licence."),
  total: z.number().int().exactOptional().describe("How many icons the search found, listed or not."),
  created: z
    .object({
      id: z.string().nullable(),
      icon: z.string(),
      name: z.string(),
      width: z.number(),
      height: z.number(),
    })
    .exactOptional()
    .describe("The icon layer made (no id in a dry run)."),
  license: LicenseSchema.exactOptional().describe("The licence of the icon's set: some ask for credit."),
  errors: z.array(z.string()),
  notes: z.array(z.string()),
  dryRun: z.boolean(),
  version: VersionSavedSchema,
});
