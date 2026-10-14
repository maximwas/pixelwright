import * as z from "zod";

/** The name of a version a write saves in the file's history first, for design_apply and tokens_apply. */
export const VersionInputSchema = z
  .string()
  .min(1)
  .max(100)
  .exactOptional()
  .describe(
    "A name for a version saved in the file's history before writing, for the designer to go back to (not in a dry run). Pass one before a write that changes many layers or tokens.",
  );

/** The version a write saved, as its result gives it. */
export const VersionSavedSchema = z
  .object({
    id: z.string().nullable(),
    title: z.string(),
  })
  .exactOptional();
