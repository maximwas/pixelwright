import { VERSION_DESCRIPTION_CHARS } from "@pixelwright/core";
import * as z from "zod";
import { BaselineFigmaFileSchema, BaselineNameSchema } from "../../baselines/schemas.ts";

export const VersionSaveInputSchema = z.object({
  title: z.string().min(1).max(100).describe('The version\'s name in Version history, e.g. "Built: pricing".'),
  description: z
    .string()
    .min(1)
    .max(VERSION_DESCRIPTION_CHARS)
    .exactOptional()
    .describe("Shown under the title. Everyone with the file sees it: no local paths or private repository names."),
  baselines: z
    .array(BaselineNameSchema)
    .min(1)
    .max(10)
    .exactOptional()
    .describe(
      "The baselines this version goes with: it is saved only while the design still matches each one, and they record it.",
    ),
  file: z
    .string()
    .min(1)
    .max(1_024)
    .exactOptional()
    .describe("A session from status, or a file name. Default: the file of the first baseline, else the active file."),
});

export const VersionSaveOutputSchema = z.object({
  id: z.string().nullable().describe("The version's id; null when Figma gave none."),
  title: z.string(),
  file: BaselineFigmaFileSchema,
  baselines: z.array(z.string()).describe("The baselines that recorded the version."),
  notes: z.array(z.string()),
  support: z.string().exactOptional(),
});
