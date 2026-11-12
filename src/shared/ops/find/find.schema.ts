import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { FIND, FIND_FIELD, FIND_FILL } from "@/shared/ops/find/find.constants.ts";
import { NodeRefSchema } from "@/shared/ops/selection/selection.schema.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

const QuerySchema = zod.string().check(zod.minLength(FIND.minChars), zod.maxLength(FIND.maxChars));

/** Texts by font size in px: one with any size within every bound given matches. */
const SizeRangeSchema = zod.strictObject({
  lt: zod.exactOptional(zod.number()),
  lte: zod.exactOptional(zod.number()),
  gt: zod.exactOptional(zod.number()),
  gte: zod.exactOptional(zod.number()),
});

/**
 * What to find (T-040) inside a layer or a page, the current page when left out: by name, type or text, an instance's
 * component or variant ("State=Hover, Size=L"), with the instances counted; at most `limit` listed.
 */
export const FindOpInputSchema = zod.strictObject({
  name: zod.exactOptional(QuerySchema),
  type: zod.exactOptional(QuerySchema),
  /** A substring, or a list of them: a text matches when it holds any. */
  text: zod.exactOptional(
    zod.union([QuerySchema, zod.array(QuerySchema).check(zod.minLength(1), zod.maxLength(FIND.maxPhrases))]),
  ),
  /** A JavaScript regular expression the text's characters match, in any case. */
  textRegex: zod.exactOptional(QuerySchema),
  fontSize: zod.exactOptional(SizeRangeSchema),
  /** Instances of this component, or of any variant of this component set. */
  componentId: zod.exactOptional(NodeIdSchema),
  /** Every component property's value on each instance found. */
  properties: zod.exactOptional(zod.boolean()),
  component: zod.exactOptional(QuerySchema),
  variant: zod.exactOptional(QuerySchema),
  counts: zod.exactOptional(zod.boolean()),
  /** true: only layers shown (the layer and every ancestor visible); false: only hidden ones; both when left out. */
  visible: zod.exactOptional(zod.boolean()),
  /** Layers with a visible fill of this paint type. */
  fill: zod.exactOptional(zod.enum(FIND_FILL)),
  within: zod.exactOptional(NodeIdSchema),
  limit: zod.int().check(zod.minimum(FIND.minLimit), zod.maximum(FIND.maxLimit)),
  /** What is left of the server's one budget when it goes page by page (P-075); the op's own when left out. */
  budgetMs: zod.exactOptional(zod.int().check(zod.minimum(1), zod.maximum(LIMITS.opBudgetMs))),
});

const PropertyValueSchema = zod.union([zod.string(), zod.boolean()]);

/** A layer's ancestor, or its page, by id and name. */
const AncestorSchema = zod.object({ id: zod.string(), name: zod.string(), type: zod.string() });

export const FoundPageSchema = zod.object({ id: zod.string(), name: zod.string() });

/**
 * A layer found, its box in page px as Figma gives it (the server rounds it, D-15), its ancestors' names; whether it is
 * hidden, a text's font size, and an instance's properties that differ from its component's defaults.
 */
export const FoundSchema = zod.extend(NodeRefSchema, {
  path: zod.array(AncestorSchema).check(zod.describe(FIND_FIELD.path)),
  characters: zod.exactOptional(zod.string()).check(zod.describe(FIND_FIELD.characters)),
  cut: zod.exactOptional(zod.literal(true)).check(zod.describe(FIND_FIELD.cut)),
  properties: zod
    .exactOptional(zod.record(zod.string(), PropertyValueSchema))
    .check(zod.describe(FIND_FIELD.properties)),
  hidden: zod.exactOptional(zod.literal(true)).check(zod.describe(FIND_FIELD.hidden)),
  fontSize: zod
    .exactOptional(zod.union([zod.number(), zod.array(zod.number())]))
    .check(zod.describe(FIND_FIELD.fontSize)),
  changed: zod.exactOptional(zod.record(zod.string(), PropertyValueSchema)).check(zod.describe(FIND_FIELD.changed)),
  component: zod
    .exactOptional(zod.object({ name: zod.string(), set: zod.exactOptional(zod.string()) }))
    .check(zod.describe(FIND_FIELD.instanceOf)),
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

export type Ancestor = zod.output<typeof AncestorSchema>;

export type SizeRange = zod.output<typeof SizeRangeSchema>;

export type Counted = zod.output<typeof CountedSchema>;
