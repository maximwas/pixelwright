import { EXECUTE_CODE_CHARS, EXECUTE_DEFAULT_MS, EXECUTE_MAX_MS, OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { VersionInputSchema, VersionSavedSchema } from "../../history/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";

export const ExecuteInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(EXECUTE_CODE_CHARS)
    .exactOptional()
    .describe(
      "JavaScript run as the body of an async function with `figma` (the Plugin API) and `console`: `await` works, `return` gives the result. Give code or script.",
    ),
  script: z
    .string()
    .min(1)
    .max(1_024)
    .exactOptional()
    .describe(
      "A file of such code on the server's disk, run instead of code: an absolute path (or one from the server's folder, as design_apply's src). It is read at every call, so the file as it is now runs, after a plugin restart too.",
    ),
  timeout: z
    .number()
    .min(1)
    .max(EXECUTE_MAX_MS / 1_000)
    .default(EXECUTE_DEFAULT_MS / 1_000)
    .describe("Seconds to wait for the code: 10 by default, up to 300 for a long task."),
  version: VersionInputSchema.describe(
    "A name for a version saved in the file's history before the code runs, for the designer to go back to. Pass one before code that changes many layers.",
  ),
  file: FileSchema,
});

export const ExecuteOutputSchema = OPERATION_SCHEMAS.execute.output.extend({
  note: z
    .string()
    .exactOptional()
    .describe("When the code ran and only reads (nothing in it writes): the tools that read without code."),
  /** The version saved in the file's history before the code ran, when one was asked for. */
  version: VersionSavedSchema,
});
