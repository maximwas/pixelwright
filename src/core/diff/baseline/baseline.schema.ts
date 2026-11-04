import * as zod from "zod/mini";
import { BASELINE_CHANGE, COMPONENT_CHANGE, NOT_COMPARED } from "@/core/diff/baseline/baseline.constants.ts";

const ValueSchema = zod.nullable(zod.string());

/** A value before and now: null where a side has none. */
const PairSchema = zod.tuple([ValueSchema, ValueSchema]);
const AttributesSchema = zod.record(zod.string(), PairSchema);
const PlacedSchema = zod.object({ path: zod.string(), id: zod.string() });

/** What changed between a baseline and the design now, in design_read's terms (T-205, K-055), as 0.7.0 answered. */
export const BaselineChangesSchema = zod.object({
  changed: zod.array(
    zod.extend(PlacedSchema, {
      was: zod.exactOptional(zod.string()),
      tag: zod.string(),
      attributes: AttributesSchema,
      drawing: zod.exactOptional(zod.literal(true)),
    }),
  ),
  added: zod.array(
    zod.extend(PlacedSchema, {
      tag: zod.string(),
      was: zod.exactOptional(zod.literal(BASELINE_CHANGE.hidden)),
      xml: zod.exactOptional(zod.string()),
    }),
  ),
  removed: zod.array(
    zod.extend(PlacedSchema, { tag: zod.string(), now: zod.exactOptional(zod.literal(BASELINE_CHANGE.hidden)) }),
  ),
  moved: zod.array(zod.extend(PlacedSchema, { from: zod.string() })),
  reordered: zod.array(zod.extend(PlacedSchema, { before: zod.array(zod.string()), after: zod.array(zod.string()) })),
  components: zod.array(
    zod.object({
      component: zod.string(),
      path: zod.string(),
      change: zod.enum(COMPONENT_CHANGE),
      attributes: zod.exactOptional(AttributesSchema),
      drawing: zod.exactOptional(zod.literal(true)),
      xml: zod.exactOptional(zod.string()),
      instances: zod.array(zod.string()),
      of: zod.number(),
    }),
  ),
  tokens: zod.array(
    zod.object({
      token: zod.string(),
      name: zod.string(),
      was: zod.exactOptional(zod.string()),
      mode: zod.exactOptional(zod.string()),
      before: ValueSchema,
      after: ValueSchema,
      layers: zod.number(),
    }),
  ),
  notCompared: zod.array(zod.extend(PlacedSchema, { what: zod.enum(NOT_COMPARED) })),
});

/** How many entries each list of changes held before the cap. */
export const BaselineCountsSchema = zod.object({
  changed: zod.number(),
  added: zod.number(),
  removed: zod.number(),
  moved: zod.number(),
  reordered: zod.number(),
  components: zod.number(),
  tokens: zod.number(),
});

export type BaselineChanges = zod.output<typeof BaselineChangesSchema>;
export type BaselineCounts = zod.output<typeof BaselineCountsSchema>;
export type Pair = zod.output<typeof PairSchema>;
