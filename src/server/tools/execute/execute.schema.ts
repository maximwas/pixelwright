import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { EXECUTE_FIELD, EXECUTE_SCRIPT, EXECUTE_SECONDS } from "@/server/tools/execute/execute.constants.ts";
import { EXECUTE } from "@/shared/ops/execute/execute.constants.ts";
import { executeOp } from "@/shared/ops/execute/execute.manifest.ts";

/** One of code, codePath and script (the tool refuses none or two); timeout's default depends on which. */
export const ExecuteInputSchema = zod.strictObject({
  code: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(EXECUTE.codeChars)))
    .check(zod.describe(EXECUTE_FIELD.code)),
  codePath: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(EXECUTE_SCRIPT.pathChars)))
    .check(zod.describe(EXECUTE_FIELD.codePath)),
  script: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(EXECUTE.codeChars)))
    .check(zod.describe(EXECUTE_FIELD.script)),
  timeout: zod
    .exactOptional(zod.number().check(zod.minimum(EXECUTE_SECONDS.min), zod.maximum(EXECUTE_SECONDS.max)))
    .check(zod.describe(EXECUTE_FIELD.timeout)),
  file: FileInputSchema,
});

const ClampSchema = zod.object({ call: zod.string(), path: zod.string(), given: zod.number(), used: zod.number() });

/** The op's answer and, when the code ran and nothing in it writes, the note (T-153); a script's calls and cuts. */
export const ExecuteOutputSchema = zod.extend(executeOp.output, {
  note: zod.exactOptional(zod.string()).check(zod.describe(EXECUTE_FIELD.note)),
  calls: zod.exactOptional(zod.record(zod.string(), zod.number())).check(zod.describe(EXECUTE_FIELD.calls)),
  clamped: zod.exactOptional(zod.array(ClampSchema)).check(zod.describe(EXECUTE_FIELD.clamped)),
  resultChars: zod.exactOptional(zod.number()).check(zod.describe(EXECUTE_FIELD.resultChars)),
  notShown: zod.exactOptional(zod.array(zod.string())).check(zod.describe(EXECUTE_FIELD.notShown)),
});

export type ExecuteInput = zod.output<typeof ExecuteInputSchema>;

export type ExecuteOutput = zod.output<typeof ExecuteOutputSchema>;
