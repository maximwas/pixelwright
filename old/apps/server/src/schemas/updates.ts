import * as z from "zod";

/** latest.json: npm's last answer for the newest Pixelwright, and when it came. */
export const UpdateStateSchema = z.object({
  version: z.string(),
  checkedAt: z.string(),
});

/** What npm answers for pixelwright@latest: the manifest, of which only the version is read. */
export const NpmLatestSchema = z.object({ version: z.string().min(1).max(64) });
