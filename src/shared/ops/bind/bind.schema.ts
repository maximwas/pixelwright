import * as zod from "zod/mini";
import {
  BIND_KIND,
  BIND_KIND_FIELD,
  BIND_LIMIT,
  BIND_PAINT_AT,
  BIND_SOURCE,
  BIND_WITHIN,
} from "@/shared/ops/bind/bind.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";
import { LetterSpacingSchema, LineHeightSchema } from "@/shared/read-model/layer-text.schema.ts";
import { EffectSchema } from "@/shared/read-model/layer-values.schema.ts";

/**
 * What the bind op scans (P-164): under a layer or page, every page with "file", else the selection; the kinds of raw
 * value asked, or with remap ids each layer's uses of them instead; into instances only for overrides.
 */
export const BindOpInputSchema = zod.strictObject({
  within: zod.exactOptional(zod.union([zod.literal(BIND_WITHIN.file), NodeIdSchema])),
  kinds: zod.array(zod.enum(BIND_KIND)).check(zod.minLength(1)),
  remap: zod.array(zod.string()).check(zod.maxLength(BIND_LIMIT.maxSources)),
  overrides: zod.boolean(),
});

/** A text's run, as getStyledTextSegments gives it: characters start to end. */
const RangeSchema = zod.strictObject({ start: zod.int(), end: zod.int() });

/** Figma's inferred variables (inferredVariables) for a field or paint: the ids of those holding its value. */
const InferredSchema = zod.array(zod.string());

/**
 * A raw solid paint: where it sits (its list and index there, or a text's run and its range), its colour and opacity,
 * whether a paint style may take its place (the one paint), and the variables Figma infers for it.
 */
const ScannedPaintSchema = zod.strictObject({
  at: zod.enum(BIND_PAINT_AT),
  index: zod.int(),
  range: zod.exactOptional(RangeSchema),
  color: zod.strictObject({ r: zod.number(), g: zod.number(), b: zod.number() }),
  opacity: zod.number(),
  stylable: zod.boolean(),
  inferred: zod.exactOptional(InferredSchema),
});

/** A text run no text style sets: its range and the parts a text style sets. */
const ScannedTextSchema = zod.strictObject({
  range: RangeSchema,
  fontName: zod.strictObject({ family: zod.string(), style: zod.string() }),
  fontSize: zod.number(),
  lineHeight: LineHeightSchema,
  letterSpacing: LetterSpacingSchema,
  textCase: zod.string(),
  textDecoration: zod.string(),
});

/**
 * One layer's raw values as Figma keeps them, for the server to match: its variable modes (resolvedVariableModes),
 * layout, number fields (bound or not, and which are bound) and the variables Figma infers for its raw ones, whether
 * it draws a stroke, its raw paints, its runs no text style sets, its effects when no style or variable gives them;
 * with remap ids, how often it uses each.
 */
const ScannedLayerSchema = zod.strictObject({
  id: zod.string(),
  type: zod.string(),
  modes: zod.record(zod.string(), zod.string()),
  layout: zod.record(zod.string(), zod.string()),
  numbers: zod.record(zod.string(), zod.number()),
  bound: zod.array(zod.string()),
  inferred: zod.exactOptional(zod.record(zod.string(), InferredSchema)),
  stroked: zod.boolean(),
  paints: zod.array(ScannedPaintSchema),
  texts: zod.array(ScannedTextSchema),
  effects: zod.exactOptional(zod.array(EffectSchema)),
  uses: zod.record(zod.string(), zod.int()),
});

/** A variable Figma inferred that the file does not hold (a library's): its token's name, type, scopes and key. */
const InferredVariableSchema = zod.strictObject({
  name: zod.string(),
  resolvedType: zod.string(),
  scopes: zod.array(zod.string()),
  key: zod.string(),
  codeSyntax: zod.exactOptional(zod.record(zod.string(), zod.string())),
});

/**
 * The layers with something to bind, the library variables Figma inferred for them by id, the instances and slots'
 * default content left alone, and whether time ran out.
 */
export const BindOpOutputSchema = zod.strictObject({
  layers: zod.array(ScannedLayerSchema),
  variables: zod.record(zod.string(), InferredVariableSchema),
  instances: zod.int(),
  defaults: zod.int(),
  cut: zod.boolean(),
});

/** Where a use is on its layer: a paint's list and index (a run's range), a number's Figma fields, a run's range. */
const BindPlaceSchema = {
  color: zod.strictObject({
    kind: zod.literal(BIND_KIND.color),
    at: zod.enum(BIND_PAINT_AT),
    index: zod.int(),
    range: zod.exactOptional(RangeSchema),
    /** The paint's own opacity, kept over the token's colour; snapped, it is laid over the token's alpha. */
    opacity: zod.number(),
  }),
  number: zod.strictObject({ kind: zod.literal(BIND_KIND.number), fields: zod.array(zod.string()) }),
  text: zod.strictObject({ kind: zod.literal(BIND_KIND.text), range: RangeSchema }),
  effect: zod.strictObject({ kind: zod.literal(BIND_KIND.effect) }),
} as const;

/** A token to bind: a style or variable by id and token; a library's variable the file does not hold also by key. */
const BindTargetSchema = zod.strictObject({
  token: zod.string(),
  id: zod.string(),
  source: zod.enum(BIND_SOURCE),
  key: zod.exactOptional(zod.string()),
});

/** One raw value bound: where on which layer, to what, and snapped when the value was not the token's. */
const PLANNED_BIND = { layer: zod.string(), target: BindTargetSchema, snapped: zod.boolean() };

/**
 * What a real tokens_bind run writes (item 51's op input, exported with it): every bound use where it is, and with
 * remaps every layer's uses of a from token (by id) to rebind to its to token.
 */
const BindPlanSchema = zod.strictObject({
  binds: zod.array(
    zod.discriminatedUnion(BIND_KIND_FIELD, [
      zod.extend(BindPlaceSchema.color, PLANNED_BIND),
      zod.extend(BindPlaceSchema.number, PLANNED_BIND),
      zod.extend(BindPlaceSchema.text, PLANNED_BIND),
      zod.extend(BindPlaceSchema.effect, PLANNED_BIND),
    ]),
  ),
  remaps: zod.array(zod.strictObject({ layer: zod.string(), from: zod.string(), to: BindTargetSchema })),
});

export type ScannedLayer = zod.output<typeof ScannedLayerSchema>;

export type BindPlace = zod.output<(typeof BindPlaceSchema)[keyof typeof BindPlaceSchema]>;

export type BindTarget = zod.output<typeof BindTargetSchema>;

export type BindPlan = zod.output<typeof BindPlanSchema>;

export type PlannedBind = BindPlan["binds"][number];

export type PlannedRemap = BindPlan["remaps"][number];

export type BindScan = zod.output<typeof BindOpOutputSchema>;
