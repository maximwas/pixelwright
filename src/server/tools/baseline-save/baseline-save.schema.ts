import * as zod from "zod/mini";
import { BaselineCountsSchema } from "@/core/diff/baseline/baseline.schema.ts";
import {
  BaselineFigmaFileSchema,
  BaselineNameSchema,
  BaselineNodeSchema,
  NamedSchema,
} from "@/server/app/baselines/baselines.schema.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { BASELINE_SAVE, BASELINE_SAVE_FIELD } from "@/server/tools/baseline-save/baseline-save.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

export const BaselineSaveInputSchema = zod.strictObject({
  node: zod.exactOptional(NodeIdSchema).check(zod.describe(BASELINE_SAVE_FIELD.node)),
  name: zod.exactOptional(BaselineNameSchema).check(zod.describe(BASELINE_SAVE_FIELD.name)),
  code: zod
    .exactOptional(
      zod
        .array(zod.string().check(zod.minLength(BASELINE_SAVE.minPath), zod.maxLength(BASELINE_SAVE.maxPath)))
        .check(zod.maxLength(BASELINE_SAVE.maxCode)),
    )
    .check(zod.describe(BASELINE_SAVE_FIELD.code)),
  accept: zod
    .exactOptional(zod.string().check(zod.regex(BASELINE_SAVE.accept)))
    .check(zod.describe(BASELINE_SAVE_FIELD.accept)),
  replace: zod._default(zod.boolean(), false).check(zod.describe(BASELINE_SAVE_FIELD.replace)),
  file: FileInputSchema,
});

export const BaselineSaveOutputSchema = zod.object({
  name: zod.string(),
  path: zod.string().check(zod.describe(BASELINE_SAVE_FIELD.path)),
  node: BaselineNodeSchema,
  file: BaselineFigmaFileSchema,
  page: zod.nullable(NamedSchema).check(zod.describe(BASELINE_SAVE_FIELD.page)),
  capturedAt: zod.string().check(zod.describe(BASELINE_SAVE_FIELD.capturedAt)),
  code: zod.array(zod.string()),
  layers: zod.number().check(zod.describe(BASELINE_SAVE_FIELD.layers)),
  tokens: zod.number().check(zod.describe(BASELINE_SAVE_FIELD.tokens)),
  cut: zod.array(zod.extend(NamedSchema, { children: zod.number() })).check(zod.describe(BASELINE_SAVE_FIELD.cut)),
  replaced: zod
    .exactOptional(zod.object({ node: NamedSchema, capturedAt: zod.string(), counts: BaselineCountsSchema }))
    .check(zod.describe(BASELINE_SAVE_FIELD.replaced)),
  notes: zod.array(zod.string()),
});

export type BaselineSaveInput = zod.output<typeof BaselineSaveInputSchema>;

export type BaselineSaveOutput = zod.output<typeof BaselineSaveOutputSchema>;
