import * as zod from "zod/mini";
import { BaselineChangesSchema, BaselineCountsSchema } from "@/core/diff/baseline/baseline.schema.ts";
import { FILE_INPUT } from "@/server/app/sessions/sessions.constants.ts";
import {
  BaselineFigmaFileSchema,
  BaselineNameSchema,
  BaselineNodeSchema,
  BaselineVersionSchema,
  NamedSchema,
} from "@/server/app/stores/stores.schema.ts";
import { BASELINE_DIFF_FIELD, BASELINE_STATUS } from "@/server/tools/baseline-diff/baseline-diff.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

export const BaselineDiffInputSchema = zod.strictObject({
  name: zod.exactOptional(BaselineNameSchema).check(zod.describe(BASELINE_DIFF_FIELD.name)),
  node: zod.exactOptional(NodeIdSchema).check(zod.describe(BASELINE_DIFF_FIELD.node)),
  file: zod
    .exactOptional(zod.string().check(zod.minLength(1), zod.maxLength(FILE_INPUT.maxChars)))
    .check(zod.describe(BASELINE_DIFF_FIELD.file)),
});

/** A baseline as an answer lists it (T-205): what it holds, and how it compares now. */
const BaselineEntrySchema = zod.object({
  name: zod.string(),
  path: zod.string(),
  node: zod.exactOptional(BaselineNodeSchema),
  file: zod.exactOptional(BaselineFigmaFileSchema),
  page: zod.exactOptional(zod.nullable(NamedSchema)),
  capturedAt: zod.exactOptional(zod.string()),
  code: zod.exactOptional(zod.array(zod.string())),
  version: zod.exactOptional(BaselineVersionSchema),
  status: zod.enum(BASELINE_STATUS),
  now: zod.exactOptional(NamedSchema).check(zod.describe(BASELINE_DIFF_FIELD.now)),
  reason: zod.exactOptional(zod.string()).check(zod.describe(BASELINE_DIFF_FIELD.reason)),
  counts: zod.exactOptional(BaselineCountsSchema),
});

export const BaselineDiffOutputSchema = zod.object({
  summary: zod.string(),
  baselines: zod.array(BaselineEntrySchema),
  changes: zod.exactOptional(BaselineChangesSchema),
  accept: zod.exactOptional(zod.string()).check(zod.describe(BASELINE_DIFF_FIELD.accept)),
  more: zod.exactOptional(zod.number()).check(zod.describe(BASELINE_DIFF_FIELD.more)),
  notes: zod.array(zod.string()),
});

export type BaselineDiffInput = zod.output<typeof BaselineDiffInputSchema>;

export type BaselineDiffOutput = zod.output<typeof BaselineDiffOutputSchema>;

export type BaselineEntry = zod.output<typeof BaselineEntrySchema>;
