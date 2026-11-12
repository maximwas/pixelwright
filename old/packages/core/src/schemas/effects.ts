import * as z from "zod";
import { NodeIdSchema } from "./operation-shapes.ts";

const UnitSchema = z.number().min(0).max(1);

/** A colour as Figma's API takes it: channels from 0 to 1, alpha included. */
export const RgbaSchema = z.object({
  r: UnitSchema,
  g: UnitSchema,
  b: UnitSchema,
  a: UnitSchema,
});

/**
 * Figma's noise effect as the plugin writes it: one colour (MONOTONE), two (DUOTONE, with secondaryColor) or many
 * (MULTITONE, with its opacity). No blend mode: Figma refuses one on write (seen live on 2026-10-17).
 */
export const NoiseSpecSchema = z.object({
  noiseType: z.enum(["MONOTONE", "DUOTONE", "MULTITONE"]),
  noiseSize: z.number().positive().max(100),
  density: UnitSchema,
  color: RgbaSchema,
  secondaryColor: RgbaSchema.exactOptional(),
  opacity: UnitSchema.exactOptional(),
});

/** Figma's texture effect: grain that roughens a layer's edges, its size and radius in px. */
export const TextureSpecSchema = z.object({
  noiseSize: z.number().positive().max(100),
  radius: z.number().min(0).max(100),
  clipToShape: z.boolean(),
});

/** Figma's glass effect, on frames only: highlights, refraction, depth, colour split and the blur behind it. */
export const GlassSpecSchema = z.object({
  lightIntensity: UnitSchema,
  lightAngle: z.number().min(-360).max(360),
  refraction: UnitSchema,
  depth: z.number().min(1).max(100),
  dispersion: UnitSchema,
  radius: z.number().min(0).max(250),
});

export const EffectKindSchema = z.enum(["NOISE", "TEXTURE", "GLASS"]);

/** The effects operation: the layers, the effects to put on (each replacing its own type) and the types to take off. */
export const EffectsInputSchema = z.object({
  nodes: z.array(NodeIdSchema).min(1).max(100),
  noise: NoiseSpecSchema.exactOptional(),
  texture: TextureSpecSchema.exactOptional(),
  glass: GlassSpecSchema.exactOptional(),
  remove: z.array(EffectKindSchema).max(3).default([]),
  dryRun: z.boolean().default(false),
});

export const EffectsOutputSchema = z.object({
  /** The layers written (in a dry run: those that would be). */
  changed: z.array(z.string()),
  /** The layers left as they were, with why. */
  errors: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
    }),
  ),
});
