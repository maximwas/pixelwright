import * as zod from "zod/mini";
import { FILE_INPUT } from "@/server/app/sessions/target-resolver/target-resolver.constants.ts";

/** Which connected file a tool works on (T-001): its session from status or its name; the active file when left out. */
export const FileInputSchema = zod.exactOptional(
  zod.string().check(zod.minLength(1), zod.maxLength(FILE_INPUT.maxChars), zod.describe(FILE_INPUT.description)),
);

/** The one argument target resolution reads from a call. */
export const TargetArgsSchema = zod.object({ file: zod.optional(zod.string()) });
