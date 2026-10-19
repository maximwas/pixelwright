import * as z from "zod";
import type { EffectSpec, FontSpec, PaintSpec } from "../../css-mapping/figma-props.ts";
import { VARIABLE_SCOPES } from "../scopes.ts";
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

/** A variable's name in code per platform; "" removes a platform's. */
const CodeSyntaxSchema = z.object({
  WEB: z.string().max(512).exactOptional(),
  ANDROID: z.string().max(512).exactOptional(),
  iOS: z.string().max(512).exactOptional(),
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
              scopes: z
                .array(z.enum(VARIABLE_SCOPES))
                .max(VARIABLE_SCOPES.length)
                .exactOptional()
                .describe(
                  'The fields Figma\'s pickers offer it for, by Figma\'s names: ["FONT_WEIGHT"], ["GAP", "WIDTH_HEIGHT"]; [] hides it from all of them. A new variable is offered for every field (ALL_SCOPES), which makes a number a length in px: a font weight or an opacity needs its scope.',
                ),
              codeSyntax: CodeSyntaxSchema.exactOptional().describe(
                'Its name in code per platform: WEB (also its CSS name, as var(--name)), ANDROID, iOS; "" removes one.',
              ),
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
      text: z.array(TextStyleInputSchema()).max(2_000).default([]),
      effect: z.array(StyleInputSchema()).max(2_000).default([]),
    })
    .default({
      paint: [],
      text: [],
      effect: [],
    }),
});

/** tokens_apply's input after the schema's defaults. */
export type TokensApplyInput = z.output<typeof TokensApplyInputSchema>;

/** A style as tokens_read lists it: its name and its CSS value (a colour, a font shorthand, a shadow list). */
function StyleInputSchema() {
  return z.object({
    name: NameSchema,
    value: z.string().max(10_000),
  });
}

/** A text style as tokens_read lists it: with its letter spacing and case as tokens of their own. */
function TextStyleInputSchema() {
  return StyleInputSchema().extend({
    also: z
      .array(
        z.object({
          token: z.string().max(512),
          value: z.string().max(10_000),
        }),
      )
      .max(20)
      .exactOptional()
      .describe(
        "Its letter spacing and case as tokens_read lists them: [{token: '--Caption-letter-spacing', value: '0.04em'}, {token: '--Caption-text-transform', value: 'uppercase'}].",
      ),
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
      scopes: z.array(z.enum(VARIABLE_SCOPES)).exactOptional(),
      codeSyntax: CodeSyntaxSchema.exactOptional(),
      unitless: z.literal(true).exactOptional(),
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
        letterSpacing: z
          .object({
            unit: z.enum(["PIXELS", "PERCENT"]),
            value: z.number(),
          })
          .exactOptional(),
        textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).exactOptional(),
      }),
    ),
    effect: z.array(
      z.object({
        name: NameSchema,
        effects: EffectsSchema,
        covers: z.array(z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"])),
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
  /** What was written but may not read back as meant: a plain number Figma takes for a length. */
  notes: z.array(z.string()).exactOptional(),
});
