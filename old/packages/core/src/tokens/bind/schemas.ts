import * as z from "zod";
import { NodeIdSchema } from "../../schemas/operation-shapes.ts";
import { BIND_KINDS } from "./fields.ts";

/** A token as design_read and tokens_read write it (--brand, --h1-font), or a text style by its name (h1). */
const TokenSchema = z.string().min(1).max(300);

/** The call's pick for a value several tokens hold, or a value to snap to a token (it then takes the token's value). */
export const BindChoiceSchema = z.object({
  value: z.string().min(1).max(500).describe("The value as tokens_bind lists it: #3B2FD9, 16px, a font shorthand."),
  token: TokenSchema,
  field: z
    .string()
    .min(1)
    .max(40)
    .exactOptional()
    .describe("Only where the value is this field (background, border, color, gap, padding, border-radius…)."),
});

/** Every use of one token rebound to another of the same kind. */
export const BindRemapSchema = z.object({
  from: TokenSchema,
  to: TokenSchema,
});

/** The `bind` operation's input: what to bind under which layers or pages. */
export const BindInputSchema = z.object({
  /** Layers or pages to bind under (a page's every layer). */
  roots: z.array(NodeIdSchema).min(1).max(200),
  kinds: z
    .array(z.enum(BIND_KINDS))
    .min(1)
    .default([...BIND_KINDS]),
  choose: z.array(BindChoiceSchema).max(200).default([]),
  /** With remaps the raw values are left alone: only the uses of the `from` tokens are rebound. */
  remap: z.array(BindRemapSchema).max(50).default([]),
  /** With remaps: leave instances to their main components, or rebind the uses inside them as their overrides. */
  instances: z.enum(["leave", "override"]).default("leave"),
  /** Find what would be bound without writing (works with Allow edits off). */
  dryRun: z.boolean().default(false),
});

/** Uses of one value in one field, across layers: how many, and a few of the layers. */
const BindGroupSchema = z.object({
  kind: z.enum(BIND_KINDS),
  field: z.string().describe("Where the value is, by its CSS name: background, border, color, gap, font, effects…"),
  value: z.string(),
  count: z.number().int().min(1),
  examples: z.array(z.string()).describe("Ids of a few of the layers."),
});

export const BindOutputSchema = z.object({
  bound: z.array(
    BindGroupSchema.extend({
      token: z.string(),
      snapped: z
        .literal(true)
        .exactOptional()
        .describe("The value was not the token's: the layers take the token's value (a choice asked for it)."),
    }),
  ),
  ambiguous: z.array(BindGroupSchema.extend({ candidates: z.array(z.string()) })),
  unmatched: z.array(BindGroupSchema).describe("Raw values no token holds."),
  remapped: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      count: z.number().int(),
    }),
  ),
  /** Layers changed, or that a dry run would change. */
  layers: z.number().int().min(0),
  errors: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
    }),
  ),
  notes: z.array(z.string()),
  /** The walk ran out of time before every layer: bind the rest with narrower roots. */
  more: z.boolean(),
});

export type BindInput = z.output<typeof BindInputSchema>;

export type BindOutput = z.output<typeof BindOutputSchema>;
