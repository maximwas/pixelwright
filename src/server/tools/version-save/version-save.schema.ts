import * as zod from "zod/mini";
import { BaselineFigmaFileSchema, BaselineNameSchema } from "@/server/app/baselines/baselines.schema.ts";
import { FILE_INPUT } from "@/server/app/sessions/sessions.constants.ts";
import { WRITER_OUTPUT } from "@/server/app/writes/writes.schema.ts";
import { VERSION_SAVE, VERSION_SAVE_FIELD } from "@/server/tools/version-save/version-save.constants.ts";
import { SAVE_VERSION } from "@/shared/ops/save-version/save-version.constants.ts";

export const VersionSaveInputSchema = zod.strictObject({
  title: zod
    .string()
    .check(zod.minLength(1), zod.maxLength(SAVE_VERSION.titleChars), zod.describe(VERSION_SAVE_FIELD.title)),
  description: zod.exactOptional(
    zod
      .string()
      .check(
        zod.minLength(1),
        zod.maxLength(SAVE_VERSION.descriptionChars),
        zod.describe(VERSION_SAVE_FIELD.description),
      ),
  ),
  baselines: zod.exactOptional(
    zod
      .array(BaselineNameSchema)
      .check(zod.minLength(1), zod.maxLength(VERSION_SAVE.maxBaselines), zod.describe(VERSION_SAVE_FIELD.baselines)),
  ),
  file: zod.exactOptional(
    zod.string().check(zod.minLength(1), zod.maxLength(FILE_INPUT.maxChars), zod.describe(VERSION_SAVE_FIELD.file)),
  ),
});

export const VersionSaveOutputSchema = zod.object({
  id: zod.nullable(zod.string()).check(zod.describe(VERSION_SAVE_FIELD.id)),
  title: zod.string(),
  file: BaselineFigmaFileSchema,
  baselines: zod.array(zod.string()).check(zod.describe(VERSION_SAVE_FIELD.recorded)),
  notes: zod.array(zod.string()),
  support: WRITER_OUTPUT.support,
});

export type VersionSaveInput = zod.output<typeof VersionSaveInputSchema>;

export type VersionSaveOutput = zod.output<typeof VersionSaveOutputSchema>;
