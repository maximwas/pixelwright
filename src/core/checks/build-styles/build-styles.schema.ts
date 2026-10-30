import * as zod from "zod/mini";
import { BUILD_STYLES_FIELD } from "@/core/checks/build-styles/build-styles.constants.ts";

const MismatchSchema = zod.object({
  property: zod.string(),
  design: zod.string().check(zod.describe(BUILD_STYLES_FIELD.design)),
  from: zod.exactOptional(zod.string()).check(zod.describe(BUILD_STYLES_FIELD.from)),
  build: zod.string().check(zod.describe(BUILD_STYLES_FIELD.build)),
});

/** A build's computed styles for one layer against what the design sets (K-047). */
const StyleComparisonSchema = zod.object({
  matched: zod.int().check(zod.describe(BUILD_STYLES_FIELD.matched)),
  mismatches: zod.array(MismatchSchema).check(zod.describe(BUILD_STYLES_FIELD.mismatches)),
  notGiven: zod.array(zod.string()).check(zod.describe(BUILD_STYLES_FIELD.notGiven)),
  notCompared: zod
    .array(zod.object({ property: zod.string(), design: zod.string() }))
    .check(zod.describe(BUILD_STYLES_FIELD.notCompared)),
});

const LayerComparisonSchema = zod.extend(StyleComparisonSchema, {
  node: zod.string(),
  name: zod.string(),
  tag: zod.string().check(zod.describe(BUILD_STYLES_FIELD.tag)),
  label: zod.exactOptional(zod.string()),
});

/** styles_compare's answer (T-090): each layer, the ids the file does not hold, whether all is the same, notes. */
export const StylesComparedSchema = zod.object({
  layers: zod.array(LayerComparisonSchema).check(zod.describe(BUILD_STYLES_FIELD.layers)),
  missing: zod.array(zod.string()).check(zod.describe(BUILD_STYLES_FIELD.missing)),
  same: zod.boolean().check(zod.describe(BUILD_STYLES_FIELD.same)),
  notes: zod.array(zod.string()),
});

export type StyleComparison = zod.output<typeof StyleComparisonSchema>;

export type LayerComparison = zod.output<typeof LayerComparisonSchema>;

export type StylesCompared = zod.output<typeof StylesComparedSchema>;
