import * as zod from "zod/mini";
import { BIND_KIND, BIND_LIMIT, BIND_PAINT_AT, BIND_WITHIN } from "@/shared/ops/bind/bind.constants.ts";
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

/** A raw solid paint: where it sits, its colour and opacity, and whether a paint style may take its place (the one paint). */
const ScannedPaintSchema = zod.strictObject({
  at: zod.enum(BIND_PAINT_AT),
  color: zod.strictObject({ r: zod.number(), g: zod.number(), b: zod.number() }),
  opacity: zod.number(),
  stylable: zod.boolean(),
});

/** A text run no text style sets: the parts a text style sets. */
const ScannedTextSchema = zod.strictObject({
  fontName: zod.strictObject({ family: zod.string(), style: zod.string() }),
  fontSize: zod.number(),
  lineHeight: LineHeightSchema,
  letterSpacing: LetterSpacingSchema,
  textCase: zod.string(),
  textDecoration: zod.string(),
});

/**
 * One layer's raw values as Figma keeps them, for the server to match: its variable modes (resolvedVariableModes),
 * layout, number fields (bound or not, and which are bound), whether it draws a stroke, its raw paints, its runs no
 * text style sets, its effects when no style or variable gives them; with remap ids, how often it uses each.
 */
const ScannedLayerSchema = zod.strictObject({
  id: zod.string(),
  type: zod.string(),
  modes: zod.record(zod.string(), zod.string()),
  layout: zod.record(zod.string(), zod.string()),
  numbers: zod.record(zod.string(), zod.number()),
  bound: zod.array(zod.string()),
  stroked: zod.boolean(),
  paints: zod.array(ScannedPaintSchema),
  texts: zod.array(ScannedTextSchema),
  effects: zod.exactOptional(zod.array(EffectSchema)),
  uses: zod.record(zod.string(), zod.int()),
});

/** The layers with something to bind, the instances and slots' default content left alone, and whether time ran out. */
export const BindOpOutputSchema = zod.strictObject({
  layers: zod.array(ScannedLayerSchema),
  instances: zod.int(),
  defaults: zod.int(),
  cut: zod.boolean(),
});

export type ScannedLayer = zod.output<typeof ScannedLayerSchema>;

export type BindScan = zod.output<typeof BindOpOutputSchema>;
