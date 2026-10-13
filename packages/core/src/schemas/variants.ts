import * as z from "zod";
import { DiffChangeSchema, DiffOnlySchema } from "./diff.ts";

const LayerSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/** How a component set's variants differ from its default one. */
export const VariantsViewSchema = z.object({
  set: LayerSchema,
  properties: z.record(z.string(), z.array(z.string())).describe("Each variant property with its values."),
  default: LayerSchema.describe("The default variant: the top-left one, as Figma takes it."),
  variants: z.array(
    LayerSchema.extend({
      props: z.record(z.string(), z.string()),
      against: LayerSchema.describe(
        "The variant it is compared with: the one it differs from by a single property (a state first), else the default.",
      ),
      pseudo: z
        .string()
        .exactOptional()
        .describe("The CSS pseudo-class a state value suggests: :hover, :active, :focus-visible, :disabled."),
      same: z.boolean(),
      changed: z.array(DiffChangeSchema).describe("Attributes as [the default's, this variant's]."),
      onlyInDefault: z.array(DiffOnlySchema),
      onlyInVariant: z.array(DiffOnlySchema),
    }),
  ),
  more: z.number().int().exactOptional().describe("Variants left out: read a smaller set, or the variants one by one."),
});
