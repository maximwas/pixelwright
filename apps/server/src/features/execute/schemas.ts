import { EXECUTE_CODE_CHARS, EXECUTE_DEFAULT_MS, EXECUTE_MAX_MS, OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

export const ExecuteInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(EXECUTE_CODE_CHARS)
    .describe(
      "JavaScript run as the body of an async function with `figma` (the Plugin API) and `console`: `await` works, `return` gives the result.",
    ),
  timeout: z
    .number()
    .min(1)
    .max(EXECUTE_MAX_MS / 1_000)
    .default(EXECUTE_DEFAULT_MS / 1_000)
    .describe("Seconds to wait for the code: 10 by default, 25 at most."),
  file: FileSchema,
});

export const ExecuteOutputSchema = OPERATION_SCHEMAS.execute.output;
