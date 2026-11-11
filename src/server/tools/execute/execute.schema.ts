import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { WRITER_OUTPUT } from "@/server/app/writes/writes.schema.ts";
import { EXECUTE_FIELD, EXECUTE_SCRIPT, EXECUTE_SECONDS } from "@/server/tools/execute/execute.constants.ts";
import { EXECUTE } from "@/shared/ops/execute/execute.constants.ts";
import { executeOp } from "@/shared/ops/execute/execute.manifest.ts";
import { SAVE_VERSION } from "@/shared/ops/save-version/save-version.constants.ts";

export const ExecuteInputSchema = zod.strictObject({
  code: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(EXECUTE.codeChars)))
    .check(zod.describe(EXECUTE_FIELD.code)),
  script: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(EXECUTE_SCRIPT.pathChars)))
    .check(zod.describe(EXECUTE_FIELD.script)),
  timeout: zod
    ._default(
      zod.number().check(zod.minimum(EXECUTE_SECONDS.min), zod.maximum(EXECUTE_SECONDS.max)),
      EXECUTE_SECONDS.default,
    )
    .check(zod.describe(EXECUTE_FIELD.timeout)),
  version: zod.exactOptional(
    zod.string().check(zod.minLength(1), zod.maxLength(SAVE_VERSION.titleChars), zod.describe(EXECUTE_FIELD.version)),
  ),
  file: FileInputSchema,
});

/** The op's answer and, when the code ran and nothing in it writes, the note (T-153). */
export const ExecuteOutputSchema = zod.extend(executeOp.output, {
  note: zod.exactOptional(zod.string()).check(zod.describe(EXECUTE_FIELD.note)),
  version: WRITER_OUTPUT.version,
});

export type ExecuteInput = zod.output<typeof ExecuteInputSchema>;

export type ExecuteOutput = zod.output<typeof ExecuteOutputSchema>;
