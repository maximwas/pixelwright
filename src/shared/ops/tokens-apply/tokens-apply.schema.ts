import * as zod from "zod/mini";
import {
  PLAN_VALUE,
  PLAN_VALUE_FIELD,
  TOKEN_KIND,
  WRITABLE_TYPE,
} from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import { INTENT_EFFECT, INTENT_TEXT_CASE, INTENT_TEXT_UNIT } from "@/shared/write-intents/write-intent.constants.ts";
import {
  ColorValueSchema,
  EffectSpecSchema,
  FontSpecSchema,
  PaintSpecSchema,
} from "@/shared/write-intents/write-intent.schema.ts";

const optional = zod.exactOptional;

/**
 * A variable's value in one mode in Figma's terms: a number as Figma keeps it (an opacity in percent, FX-049, so 0.5
 * is written 50), a colour on the wire, an alias by its target's token. An alias carries its target's id when the file
 * holds the target (a library's the page uses too), or the key of an enabled library's variable the file does not use
 * yet, which the writer imports (m:acc257ba); one made in the same call has neither, and is found by token among the
 * variables the writer made.
 */
const PlanValueSchema = zod.discriminatedUnion(PLAN_VALUE_FIELD, [
  zod.strictObject({ kind: zod.literal(PLAN_VALUE.color), color: ColorValueSchema }),
  zod.strictObject({ kind: zod.literal(PLAN_VALUE.number), value: zod.number() }),
  zod.strictObject({ kind: zod.literal(PLAN_VALUE.string), value: zod.string() }),
  zod.strictObject({ kind: zod.literal(PLAN_VALUE.boolean), value: zod.boolean() }),
  zod.strictObject({
    kind: zod.literal(PLAN_VALUE.alias),
    token: zod.string(),
    id: optional(zod.string()),
    key: optional(zod.string()),
  }),
]);

/** Where a token's variable is: the file's by id, an enabled library's by key to import, else made by the call. */
const VariableTargetSchema = zod.strictObject({ id: optional(zod.string()), key: optional(zod.string()) });

/** A variable to make (no id) or to change (its id), with only what differs from what the file holds. */
const VariablePlanSchema = zod.strictObject({
  name: zod.string(),
  id: optional(zod.string()),
  /** Always known: a new variable of only aliases has its target's, and one nothing types is refused in core. */
  type: zod.enum(WRITABLE_TYPE),
  /** By mode name: only the modes whose value differs. */
  values: zod.record(zod.string(), PlanValueSchema),
  description: optional(zod.string()),
  scopes: optional(zod.array(zod.string())),
  /** Per platform; "" removes one. WEB also carries a CSS name other than the name's own (K-021). */
  codeSyntax: optional(
    zod.strictObject({ WEB: optional(zod.string()), ANDROID: optional(zod.string()), iOS: optional(zod.string()) }),
  ),
});

/** A collection to make (no id: its first mode renames Figma's default) or to add modes and variables to. */
const CollectionPlanSchema = zod.strictObject({
  name: zod.string(),
  id: optional(zod.string()),
  /** The modes to add, in the order they first appear (K-025). */
  modes: zod.array(zod.string()),
  variables: zod.array(VariablePlanSchema),
});

const StyleFields = { name: zod.string(), id: optional(zod.string()) };

/**
 * What the plugin writes (T-165): only what the file lacks or holds otherwise, nothing to delete; each style as
 * design_apply's own readers made its CSS (C-173), an effect style replacing only the effect types its CSS names.
 * No order is needed among variables: every new variable has its type, so the writer makes them all first and writes
 * the values after, and core has refused an alias cycle and an alias of another type than its variable's.
 */
export const TokensPlanSchema = zod.strictObject({
  collections: zod.array(CollectionPlanSchema),
  styles: zod.strictObject({
    paint: zod.array(zod.strictObject({ ...StyleFields, paints: zod.array(PaintSpecSchema) })),
    text: zod.array(
      zod.strictObject({
        ...StyleFields,
        font: FontSpecSchema,
        letterSpacing: optional(zod.strictObject({ unit: zod.enum(INTENT_TEXT_UNIT), value: zod.number() })),
        textCase: optional(zod.enum(INTENT_TEXT_CASE)),
      }),
    ),
    effect: zod.array(
      zod.strictObject({
        ...StyleFields,
        effects: zod.array(EffectSpecSchema),
        covers: zod.array(zod.enum(INTENT_EFFECT)),
      }),
    ),
  }),
  /** The colour variables the styles name, by token; left out when they name none. */
  targets: optional(zod.record(zod.string(), VariableTargetSchema)),
});

export type TokensPlan = zod.output<typeof TokensPlanSchema>;

export type CollectionPlan = TokensPlan["collections"][number];

export type VariablePlan = CollectionPlan["variables"][number];

export type PlanValue = VariablePlan["values"][string];

export type WritableType = (typeof WRITABLE_TYPE)[keyof typeof WRITABLE_TYPE];

export type StylePlans = TokensPlan["styles"];

export type VariableTarget = zod.output<typeof VariableTargetSchema>;

/** Something tokens_apply made or changed. */
export const TokenItemSchema = zod.object({
  kind: zod.enum(TOKEN_KIND),
  name: zod.string(),
  collection: optional(zod.string()),
});

/** Something tokens_apply could not write, and why. */
export const TokenErrorSchema = zod.object({
  kind: zod.enum(TOKEN_KIND),
  name: zod.string(),
  collection: optional(zod.string()),
  mode: optional(zod.string()),
  message: zod.string(),
});

export type TokenItem = zod.output<typeof TokenItemSchema>;

export type TokenError = zod.output<typeof TokenErrorSchema>;
