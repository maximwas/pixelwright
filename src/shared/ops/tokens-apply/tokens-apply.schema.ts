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
 * is written 50), a colour on the wire, an alias by its target's token.
 */
const PlanValueSchema = zod.discriminatedUnion(PLAN_VALUE_FIELD, [
  zod.strictObject({ kind: zod.literal(PLAN_VALUE.color), color: ColorValueSchema }),
  zod.strictObject({ kind: zod.literal(PLAN_VALUE.number), value: zod.number() }),
  zod.strictObject({ kind: zod.literal(PLAN_VALUE.string), value: zod.string() }),
  zod.strictObject({ kind: zod.literal(PLAN_VALUE.boolean), value: zod.boolean() }),
  zod.strictObject({ kind: zod.literal(PLAN_VALUE.alias), token: zod.string() }),
]);

/** A variable to make (no id) or to change (its id), with only what differs from what the file holds. */
const VariablePlanSchema = zod.strictObject({
  name: zod.string(),
  id: optional(zod.string()),
  /** Null for a new variable whose every value is an alias: it takes its target's type. */
  type: zod.nullable(zod.enum(WRITABLE_TYPE)),
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
 */
const TokensPlanSchema = zod.strictObject({
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
});

export type TokensPlan = zod.output<typeof TokensPlanSchema>;

type CollectionPlan = TokensPlan["collections"][number];

export type VariablePlan = CollectionPlan["variables"][number];

export type PlanValue = VariablePlan["values"][string];

export type WritableType = (typeof WRITABLE_TYPE)[keyof typeof WRITABLE_TYPE];

export type StylePlans = TokensPlan["styles"];

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
