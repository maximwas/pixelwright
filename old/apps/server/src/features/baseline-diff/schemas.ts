import * as z from "zod";
import {
  BaselineFigmaFileSchema,
  BaselineNameSchema,
  BaselineNodeSchema,
  CountsSchema,
  NamedSchema,
} from "../../baselines/schemas.ts";

export const BaselineDiffInputSchema = z.object({
  name: BaselineNameSchema.exactOptional().describe(
    "One baseline in detail. Without it: every baseline in the project, with how much changed.",
  ),
  node: z
    .string()
    .min(1)
    .max(200)
    .exactOptional()
    .describe(
      "Compare with this layer instead of the baseline's own, e.g. a v2 the designer made beside it. Needs name.",
    ),
  file: z
    .string()
    .min(1)
    .max(1_024)
    .exactOptional()
    .describe(
      "With name: compare in this file (a session from status, or a file name). Without name: only this file's baselines. Default: the file each baseline came from.",
    ),
});

const PairSchema = z.tuple([z.string().nullable(), z.string().nullable()]);
const AttributesSchema = z.record(z.string(), PairSchema);
const PlacedSchema = z.object({
  path: z.string(),
  id: z.string(),
});

export const ChangesSchema = z.object({
  changed: z.array(
    PlacedSchema.extend({
      was: z.string().exactOptional(),
      tag: z.string(),
      attributes: AttributesSchema,
      drawing: z.literal(true).exactOptional(),
    }),
  ),
  added: z.array(
    PlacedSchema.extend({
      tag: z.string(),
      was: z.literal("hidden").exactOptional(),
      xml: z.string().exactOptional(),
    }),
  ),
  removed: z.array(
    PlacedSchema.extend({
      tag: z.string(),
      now: z.literal("hidden").exactOptional(),
    }),
  ),
  moved: z.array(PlacedSchema.extend({ from: z.string() })),
  reordered: z.array(
    PlacedSchema.extend({
      before: z.array(z.string()),
      after: z.array(z.string()),
    }),
  ),
  components: z.array(
    z.object({
      component: z.string(),
      path: z.string(),
      change: z.enum(["changed", "added", "removed"]),
      attributes: AttributesSchema.exactOptional(),
      drawing: z.literal(true).exactOptional(),
      xml: z.string().exactOptional(),
      instances: z.array(z.string()),
      of: z.number(),
    }),
  ),
  tokens: z.array(
    z.object({
      token: z.string(),
      name: z.string(),
      was: z.string().exactOptional(),
      mode: z.string().exactOptional(),
      before: z.string().nullable(),
      after: z.string().nullable(),
      layers: z.number(),
    }),
  ),
  notCompared: z.array(PlacedSchema.extend({ what: z.enum(["children", "drawing"]) })),
});

export const BaselineEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  node: BaselineNodeSchema.exactOptional(),
  file: BaselineFigmaFileSchema.exactOptional(),
  page: NamedSchema.nullable().exactOptional(),
  capturedAt: z.string().exactOptional(),
  code: z.array(z.string()).exactOptional(),
  version: z
    .object({
      id: z.string().nullable(),
      title: z.string(),
      savedAt: z.string(),
    })
    .exactOptional(),
  status: z.enum(["same", "changed", "missing", "hidden", "unavailable", "unchecked"]),
  now: NamedSchema.exactOptional().describe("Compared with another layer: node, or the root found again by name."),
  reason: z.string().exactOptional().describe("Missing, hidden, unavailable: what happened, and what to do."),
  counts: CountsSchema.exactOptional(),
});

export const BaselineDiffOutputSchema = z.object({
  summary: z.string(),
  baselines: z.array(BaselineEntrySchema),
  changes: ChangesSchema.exactOptional(),
  accept: z.string().exactOptional().describe("Pass it to baseline_save once your code has these changes."),
  more: z.number().exactOptional().describe("Baselines past 50, or entries past 200 in one list."),
  notes: z.array(z.string()),
});
