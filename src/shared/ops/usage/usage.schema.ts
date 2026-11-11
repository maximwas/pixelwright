import * as zod from "zod/mini";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";
import { USAGE, USAGE_FIELD, USAGE_WITHIN } from "@/shared/ops/usage/usage.constants.ts";

/**
 * What the usage op looks for (T-106, P-126): a style or variable by id, or with raw the colours bound to neither;
 * where to look, and how long (D-48).
 */
export const UsageOpInputSchema = zod.strictObject({
  id: zod.exactOptional(zod.string()),
  variable: zod.exactOptional(zod.boolean()),
  raw: zod.exactOptional(zod.literal(true)),
  within: zod.exactOptional(zod.union([zod.literal(USAGE_WITHIN.file), NodeIdSchema])),
  budgetMs: zod.int().check(zod.minimum(USAGE.minBudgetMs), zod.maximum(USAGE.maxBudgetMs)),
});

/** A layer that uses it, and where; with raw, one entry per colour use. */
const UsageLayerSchema = zod.strictObject({
  id: zod.string(),
  name: zod.string(),
  type: zod.string(),
  property: zod.string().check(zod.describe(USAGE_FIELD.property)),
  hidden: zod.exactOptional(zod.literal(true)).check(zod.describe(USAGE_FIELD.hidden)),
  color: zod
    .exactOptional(zod.strictObject({ r: zod.number(), g: zod.number(), b: zod.number() }))
    .check(zod.describe(USAGE_FIELD.color)),
});

/** The layers that use it, USAGE.maxLayers at most; more when there are others; cut when the budget ended the scan. */
export const UsageOpOutputSchema = zod.object({
  layers: zod.array(UsageLayerSchema),
  more: zod.boolean(),
  cut: zod.boolean(),
});
