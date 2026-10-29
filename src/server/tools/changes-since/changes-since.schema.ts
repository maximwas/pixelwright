import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { CHANGES_SINCE_FIELD } from "@/server/tools/changes-since/changes-since.constants.ts";
import { changesOp } from "@/shared/ops/changes/changes.manifest.ts";

export const ChangesSinceInputSchema = zod.strictObject({
  cursor: zod.exactOptional(zod.int().check(zod.minimum(0))).check(zod.describe(CHANGES_SINCE_FIELD.cursor)),
  file: FileInputSchema,
});

export const ChangesSinceOutputSchema = changesOp.output;

export type ChangesSinceInput = zod.output<typeof ChangesSinceInputSchema>;

export type ChangesSinceOutput = zod.output<typeof ChangesSinceOutputSchema>;
