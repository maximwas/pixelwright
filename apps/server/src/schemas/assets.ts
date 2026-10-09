import * as z from "zod";

/** written-files.json: the layers each file design_read or assets_export wrote shows, by the file's SHA-1. */
export const WrittenFilesFileSchema = z.object({
  version: z.literal(1),
  files: z.record(z.string(), z.array(z.string())),
});
