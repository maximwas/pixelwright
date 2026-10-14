import * as z from "zod";
import type { EffectSpec, FontSpec, PaintSpec } from "../../types/apply.ts";
import type { CollectionPlan, TokenError, TokenItem, TokensPlan, VariableValueSpec } from "./types.ts";

const NameSchema = z.string().min(1).max(512);
/** A colour on the wire: sRGB channels, or Display P3 ones when `space` says so (the plugin writes it in the file's). */
const ColorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number(),
  space: z.literal("display-p3").exactOptional(),
});

/**
 * What tokens_apply takes: the JSON tokens_read returns (its other keys, like defaultMode, selectors and notes, are
 * read past), or the same shape written by hand. Values are CSS, as tokens_read writes them.
 */
export const TokensApplyInputSchema = z.object({
  collections: z
    .array(
      z.object({
        name: NameSchema,
        modes: z.array(NameSchema).max(40).exactOptional(),
        variables: z
          .array(
            z.object({
              name: NameSchema,
              type: z.string().max(32).exactOptional(),
              values: z.record(NameSchema, z.string().max(10_000)),
              description: z.string().max(10_000).exactOptional(),
              token: z.string().max(512).exactOptional(),
            }),
          )
          .max(5_000),
      }),
    )
    .max(200)
    .default([]),
  styles: z
    .object({
      paint: z.array(StyleInputSchema()).max(2_000).default([]),
      text: z.array(StyleInputSchema()).max(2_000).default([]),
      effect: z.array(StyleInputSchema()).max(2_000).default([]),
    })
    .default({
      paint: [],
      text: [],
      effect: [],
    }),
});

/** A style as tokens_read lists it: its name and its CSS value (a colour, a font shorthand, a shadow list). */
function StyleInputSchema() {
  return z.object({
    name: NameSchema,
    value: z.string().max(10_000),
  });
}

const ValueSchema: z.ZodType<VariableValueSpec, VariableValueSpec> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("color"),
    color: ColorSchema,
  }),
  z.object({
    kind: z.literal("number"),
    value: z.number(),
  }),
  z.object({
    kind: z.literal("string"),
    value: z.string(),
  }),
  z.object({
    kind: z.literal("boolean"),
    value: z.boolean(),
  }),
  z.object({
    kind: z.literal("alias"),
    token: z.string(),
  }),
]);

const CollectionPlanSchema: z.ZodType<CollectionPlan, CollectionPlan> = z.object({
  name: NameSchema,
  modes: z.array(NameSchema),
  variables: z.array(
    z.object({
      name: NameSchema,
      type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).nullable(),
      values: z.record(NameSchema, ValueSchema),
      description: z.string().exactOptional(),
      token: z.string().exactOptional(),
    }),
  ),
});

/** Paints, fonts and shadows as core's own readers made them, as the apply op takes FigmaProps. */
const PaintsSchema = z.custom<readonly PaintSpec[]>((value) => Array.isArray(value), "Expected paints");
const FontSchema = z.custom<FontSpec>((value) => typeof value === "object" && value !== null, "Expected a font");
const EffectsSchema = z.custom<readonly EffectSpec[]>((value) => Array.isArray(value), "Expected effects");

export const TokensPlanSchema: z.ZodType<TokensPlan, TokensPlan> = z.object({
  collections: z.array(CollectionPlanSchema),
  styles: z.object({
    paint: z.array(
      z.object({
        name: NameSchema,
        paints: PaintsSchema,
      }),
    ),
    text: z.array(
      z.object({
        name: NameSchema,
        font: FontSchema,
      }),
    ),
    effect: z.array(
      z.object({
        name: NameSchema,
        effects: EffectsSchema,
      }),
    ),
  }),
});

const KindSchema = z.enum(["collection", "mode", "variable", "paint", "text", "effect"]);

export const TokenItemSchema: z.ZodType<TokenItem, TokenItem> = z.object({
  kind: KindSchema,
  name: z.string(),
  collection: z.string().exactOptional(),
});

export const TokenErrorSchema: z.ZodType<TokenError, TokenError> = z.object({
  kind: KindSchema,
  name: z.string(),
  collection: z.string().exactOptional(),
  mode: z.string().exactOptional(),
  message: z.string(),
});

/** What tokens_apply made, changed and could not write. */
export const TokensApplyResultSchema = z.object({
  created: z.array(TokenItemSchema),
  updated: z.array(TokenItemSchema),
  errors: z.array(TokenErrorSchema),
});
