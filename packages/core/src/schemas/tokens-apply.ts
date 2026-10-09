import * as z from "zod";
import type { CollectionPlan, TokenError, TokenItem, TokensPlan, VariableValueSpec } from "../types/tokens-apply.ts";

const NameSchema = z.string().min(1).max(512);
const ColorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number(),
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
});

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

export const TokensPlanSchema: z.ZodType<TokensPlan, TokensPlan> = z.object({
  collections: z.array(CollectionPlanSchema),
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
