import * as z from "zod";
import { NodeIdSchema } from "../schemas/operation-shapes.ts";

/** One find-and-replace: plain text or a regular expression (its groups as $1 and $<name>). */
export const TextReplacementSchema = z.object({
  find: z.string().min(1).max(1_000),
  replace: z.string().max(10_000),
  regex: z.boolean().default(false).describe("find is a JavaScript regular expression; replace may use $1, $<name>."),
  caseSensitive: z.boolean().default(false),
  wholeWord: z.boolean().default(false).describe("Match only where no letter or digit touches the match."),
});

/** The `texts` operation: every text under the roots with the replacements made, its runs' styles kept. */
export const TextsInputSchema = z.object({
  /** Layers or pages whose texts to change. */
  roots: z.array(NodeIdSchema).min(1).max(200),
  replacements: z.array(TextReplacementSchema).min(1).max(500),
  /** Find what would change without writing (works with Allow edits off). */
  dryRun: z.boolean().default(false),
});

export const TextsOutputSchema = z.object({
  changed: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      before: z.string(),
      after: z.string(),
      count: z.number().int().min(1),
      property: z
        .string()
        .exactOptional()
        .describe("The component text property the change went through, for a text an instance shows from one."),
    }),
  ),
  /** Texts changed, and matches replaced, in all (the list stops at its limit). */
  texts: z.number().int().min(0),
  count: z.number().int().min(0),
  errors: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
    }),
  ),
  /** The time ran out before every text: change the rest with narrower roots. */
  more: z.boolean(),
});

export type TextsInput = z.output<typeof TextsInputSchema>;

export type TextsOutput = z.output<typeof TextsOutputSchema>;
