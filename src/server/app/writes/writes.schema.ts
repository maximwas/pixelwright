import * as zod from "zod/mini";
import { WRITES_TEXT } from "@/server/app/writes/writes.constants.ts";
import { SAVE_VERSION } from "@/shared/ops/save-version/save-version.constants.ts";

/** `version` on every writer's input (T-011, D-35). */
export const VersionInputSchema = zod.exactOptional(
  zod.string().check(zod.minLength(1), zod.maxLength(SAVE_VERSION.titleChars), zod.describe(WRITES_TEXT.versionField)),
);

/** `dryRun` on the input of a writer whose op honours it (T-012, D-35). */
export const DryRunInputSchema = zod._default(zod.boolean(), false).check(zod.describe(WRITES_TEXT.dryRunField));

/** A version saved before a write. */
const SavedVersionSchema = zod.object({ id: zod.nullable(zod.string()), title: zod.string() });

/** The fields WriteTool adds to a writer's answer: dry, the version saved first, the weekly support sentence (T-006). */
export const WRITER_OUTPUT = {
  dry: zod.exactOptional(zod.literal(true)).check(zod.describe(WRITES_TEXT.dryOutput)),
  version: zod.exactOptional(SavedVersionSchema).check(zod.describe(WRITES_TEXT.versionOutput)),
  support: zod.exactOptional(zod.string()),
};

const WriterOutputSchema = zod.object(WRITER_OUTPUT);

export type WriterOutput = zod.output<typeof WriterOutputSchema>;

export type SavedVersion = zod.output<typeof SavedVersionSchema>;
