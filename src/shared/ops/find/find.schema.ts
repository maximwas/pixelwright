import * as zod from "zod/mini";
import { FIND, FIND_FIELD } from "@/shared/ops/find/find.constants.ts";
import { NodeRefSchema } from "@/shared/ops/selection/selection.schema.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

const QuerySchema = zod.string().check(zod.minLength(FIND.minChars), zod.maxLength(FIND.maxChars));

/**
 * What to find (T-040) inside a layer or a page, the current page when left out: by name, type or text, an instance's
 * component or variant ("State=Hover, Size=L"), with the instances counted; at most `limit` listed.
 */
export const FindOpInputSchema = zod.strictObject({
  name: zod.exactOptional(QuerySchema),
  type: zod.exactOptional(QuerySchema),
  text: zod.exactOptional(QuerySchema),
  component: zod.exactOptional(QuerySchema),
  variant: zod.exactOptional(QuerySchema),
  counts: zod.exactOptional(zod.boolean()),
  within: zod.exactOptional(NodeIdSchema),
  limit: zod.int().check(zod.minimum(FIND.minLimit), zod.maximum(FIND.maxLimit)),
});

/** A layer found, its box in page px as Figma gives it (the server rounds it, D-15), and its ancestors' names. */
const FoundSchema = zod.extend(NodeRefSchema, { path: zod.array(zod.string()) });

const CountedSchema = zod.object({
  component: zod.string().check(zod.describe(FIND_FIELD.component)),
  variant: zod.exactOptional(zod.string()).check(zod.describe(FIND_FIELD.componentVariant)),
  count: zod.int().check(zod.minimum(FIND.minCount)),
});

export const FindOpOutputSchema = zod.object({
  nodes: zod.array(FoundSchema),
  more: zod.boolean(),
  variant: zod.exactOptional(zod.record(zod.string(), zod.string())).check(zod.describe(FIND_FIELD.variant)),
  counts: zod.exactOptional(zod.array(CountedSchema)).check(zod.describe(FIND_FIELD.counts)),
  countsCut: zod.exactOptional(zod.literal(true)).check(zod.describe(FIND_FIELD.countsCut)),
});

export type Found = zod.output<typeof FoundSchema>;

export type Counted = zod.output<typeof CountedSchema>;
