import * as zod from "zod/mini";
import { DIFF_FIELD } from "@/core/diff/diff.constants.ts";

const ValueSchema = zod.nullable(zod.string());

/** A layer both sides have whose attributes or drawing differ: its path, both ids, each attribute as [A, B]. */
const DiffChangeSchema = zod.strictObject({
  path: zod.string(),
  a: zod.string(),
  b: zod.string(),
  attributes: zod.record(zod.string(), zod.tuple([ValueSchema, ValueSchema])),
  drawing: zod.exactOptional(zod.literal(true)).check(zod.describe(DIFF_FIELD.drawing)),
});

/** A layer only one side has. */
const OnlyInSchema = zod.strictObject({ path: zod.string(), id: zod.string() });

/** How layer B differs from layer A as design_read reads them (K-051). */
export const DesignDiffSchema = zod.strictObject({
  same: zod.boolean(),
  onlyInA: zod.array(OnlyInSchema),
  onlyInB: zod.array(OnlyInSchema),
  changed: zod.array(DiffChangeSchema),
});

/** variants_read's answer (T-086): the set, its properties, its default, each other variant against its baseline. */
export const VariantsViewSchema = zod.strictObject({
  set: zod.strictObject({ id: zod.string(), name: zod.string() }),
  properties: zod.record(zod.string(), zod.array(zod.string())).check(zod.describe(DIFF_FIELD.properties)),
  default: zod.strictObject({ id: zod.string(), name: zod.string() }).check(zod.describe(DIFF_FIELD.default)),
  variants: zod.array(
    zod.strictObject({
      id: zod.string(),
      name: zod.string(),
      props: zod.record(zod.string(), zod.string()),
      against: zod.strictObject({ id: zod.string(), name: zod.string() }).check(zod.describe(DIFF_FIELD.against)),
      pseudo: zod.exactOptional(zod.string()).check(zod.describe(DIFF_FIELD.pseudo)),
      same: zod.boolean(),
      changed: zod.array(DiffChangeSchema).check(zod.describe(DIFF_FIELD.changed)),
      onlyInDefault: zod.array(OnlyInSchema),
      onlyInVariant: zod.array(OnlyInSchema),
    }),
  ),
  more: zod.exactOptional(zod.int()).check(zod.describe(DIFF_FIELD.more)),
});

/** breakpoints_find's answer (T-087): the screen at each width, narrowest first, with its score. */
export const BreakpointsViewSchema = zod.strictObject({
  summary: zod.string(),
  widths: zod
    .array(
      zod.strictObject({
        id: zod.string(),
        name: zod.string(),
        width: zod.number(),
        height: zod.number(),
        score: zod.number().check(zod.describe(DIFF_FIELD.score)),
        this: zod.exactOptional(zod.literal(true)).check(zod.describe(DIFF_FIELD.this)),
      }),
    )
    .check(zod.describe(DIFF_FIELD.widths)),
});

export type DiffChange = zod.output<typeof DiffChangeSchema>;
export type OnlyIn = zod.output<typeof OnlyInSchema>;
export type LayersDiff = zod.output<typeof DesignDiffSchema>;
export type VariantsView = zod.output<typeof VariantsViewSchema>;
export type BreakpointsView = zod.output<typeof BreakpointsViewSchema>;
