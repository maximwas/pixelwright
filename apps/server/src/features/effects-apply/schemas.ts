import { EffectsOutputSchema, OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { VersionInputSchema, VersionSavedSchema } from "../../history/schemas.ts";
import { FileSchema } from "../../plugin/file-schema.ts";
import { PRESET_NAMES } from "./constants.ts";

const UnitSchema = z.number().min(0).max(1);

export const NoiseValuesSchema = z
  .object({
    type: z
      .enum(["mono", "duo", "multi"])
      .exactOptional()
      .describe("mono: grain of one colour; duo: of color and secondColor; multi: of many colours at opacity."),
    size: z.number().positive().max(100).exactOptional().describe("The grain's size in px."),
    density: UnitSchema.exactOptional().describe("How much of the layer the grain covers, 0 to 1."),
    color: z.string().max(100).exactOptional().describe("The grain's CSS colour, its alpha how strong it shows."),
    secondColor: z.string().max(100).exactOptional().describe("duo's second colour."),
    opacity: UnitSchema.exactOptional().describe("multi's opacity."),
  })
  .describe("Figma's noise effect: grain over the layer.");

export const TextureValuesSchema = z
  .object({
    size: z.number().positive().max(100).exactOptional().describe("The grain's size in px."),
    radius: z.number().min(0).max(100).exactOptional().describe("How far the edges break up, in px."),
    clip: z.boolean().exactOptional().describe("Keep the texture inside the layer's shape."),
  })
  .describe("Figma's texture effect: a faint printed, cracked look over the layer and its edges.");

export const GlassValuesSchema = z
  .object({
    light: UnitSchema.exactOptional().describe("How bright the highlights are, 0 to 1."),
    angle: z.number().min(-360).max(360).exactOptional().describe("Where the light comes from, in degrees."),
    refraction: UnitSchema.exactOptional().describe("How much it bends what lies behind, 0 to 1."),
    depth: z.number().min(1).max(100).exactOptional().describe("How thick the glass looks, 1 or more."),
    dispersion: UnitSchema.exactOptional().describe("How much it splits colours at the edges, 0 to 1."),
    blur: z.number().min(0).max(250).exactOptional().describe("The blur of what lies behind, in px."),
  })
  .describe("Figma's glass effect, on frames only.");

/** An effect look in the tool's words: what a preset stands for, or what a call gives. */
export const EffectValuesSchema = z.object({
  noise: NoiseValuesSchema.exactOptional(),
  texture: TextureValuesSchema.exactOptional(),
  glass: GlassValuesSchema.exactOptional(),
});

export type EffectValues = z.input<typeof EffectValuesSchema>;

export const EffectsApplyInputSchema = EffectValuesSchema.extend({
  nodes: OPERATION_SCHEMAS.effects.input.shape.nodes.describe('The layers\' ids, e.g. ["54:243"].'),
  preset: z
    .enum(PRESET_NAMES)
    .exactOptional()
    .describe(
      "A ready look: grain (fine dark grain: on a dark layer give noise.color a light colour), film (black and white grain), risograph (grain of many colours), frosted-glass or clear-glass (on frames). noise, texture or glass change its values.",
    ),
  remove: z
    .array(z.enum(["noise", "texture", "glass"]))
    .max(3)
    .default([])
    .describe("Effect types to take off the layers."),
  dryRun: z.boolean().default(false).describe("Check the layers without writing; works with Allow edits off."),
  version: VersionInputSchema,
  file: FileSchema,
});

export const EffectsApplyOutputSchema = EffectsOutputSchema.extend({
  dryRun: z.boolean(),
  /** The version saved in the file's history before the write, when one was asked for. */
  version: VersionSavedSchema,
});
