import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
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
  /** true: only layers shown (the layer and every ancestor visible); false: only hidden ones; both when left out. */
  visible: zod.exactOptional(zod.boolean()),
  within: zod.exactOptional(NodeIdSchema),
  limit: zod.int().check(zod.minimum(FIND.minLimit), zod.maximum(FIND.maxLimit)),
  /** What is left of the server's one budget when it goes page by page (P-075); the op's own when left out. */
  budgetMs: zod.exactOptional(zod.int().check(zod.minimum(1), zod.maximum(LIMITS.opBudgetMs))),
});

const PropertyValueSchema = zod.union([zod.string(), zod.boolean()]);

/**
 * A layer found, its box in page px as Figma gives it (the server rounds it, D-15), its ancestors' names; whether it is
 * hidden, a text's font size, and an instance's properties that differ from its component's defaults.
 */
const FoundSchema = zod.extend(NodeRefSchema, {
  path: zod.array(zod.string()),
  hidden: zod.exactOptional(zod.literal(true)).check(zod.describe(FIND_FIELD.hidden)),
  fontSize: zod
    .exactOptional(zod.union([zod.number(), zod.array(zod.number())]))
    .check(zod.describe(FIND_FIELD.fontSize)),
  changed: zod.exactOptional(zod.record(zod.string(), PropertyValueSchema)).check(zod.describe(FIND_FIELD.changed)),
});

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
