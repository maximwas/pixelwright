import { BridgeError, Color, type OperationInput } from "@pixelwright/core";
import type * as z from "zod";
import { EFFECT_DEFAULTS, EFFECT_PRESETS } from "./constants.ts";
import type { EffectsApplyInputSchema } from "./schemas.ts";

type Request = Omit<z.output<typeof EffectsApplyInputSchema>, "dryRun" | "version" | "file">;
type Effects = Pick<OperationInput<"effects">, "noise" | "texture" | "glass" | "remove">;

const NOISE_TYPES = {
  mono: "MONOTONE",
  duo: "DUOTONE",
  multi: "MULTITONE",
} as const;

/**
 * The effects the plugin writes for a call: its preset's values with the call's own over them, the rest from the
 * defaults; colours as Figma's channels. A call that asks for nothing, or a colour that is not CSS, is refused.
 */
export function effectsOf({ preset, noise, texture, glass, remove }: Request): Effects {
  const base = preset === undefined ? {} : EFFECT_PRESETS[preset];
  const noiseValues = valuesOf(base, "noise", noise, EFFECT_DEFAULTS.noise);
  const textureValues = valuesOf(base, "texture", texture, EFFECT_DEFAULTS.texture);
  const glassValues = valuesOf(base, "glass", glass, EFFECT_DEFAULTS.glass);

  if (noiseValues === undefined && textureValues === undefined && glassValues === undefined && remove.length === 0) {
    throw new BridgeError("OP_FAILED", "effects_apply needs a preset, noise, texture, glass or remove.");
  }

  return {
    ...(noiseValues === undefined ? {} : { noise: noiseOf(noiseValues) }),
    ...(textureValues === undefined ? {} : { texture: textureOf(textureValues) }),
    ...(glassValues === undefined ? {} : { glass: glassOf(glassValues) }),
    remove: remove.map((kind) => kind.toUpperCase() as Effects["remove"][number]),
  };
}

/** One effect's values: the defaults, the preset's over them, the call's over those; none when neither names it. */
function valuesOf<K extends "noise" | "texture" | "glass", V extends object>(
  base: object,
  key: K,
  given: object | undefined,
  defaults: V,
): V | undefined {
  return given === undefined && !(key in base)
    ? undefined
    : {
        ...defaults,
        ...pick(base, key),
        ...given,
      };
}

function textureOf(texture: typeof EFFECT_DEFAULTS.texture): NonNullable<Effects["texture"]> {
  return {
    noiseSize: texture.size,
    radius: texture.radius,
    clipToShape: texture.clip,
  };
}

function glassOf(glass: typeof EFFECT_DEFAULTS.glass): NonNullable<Effects["glass"]> {
  return {
    lightIntensity: glass.light,
    lightAngle: glass.angle,
    refraction: glass.refraction,
    depth: glass.depth,
    dispersion: glass.dispersion,
    radius: glass.blur,
  };
}

/** A preset's values for one effect, or none. */
function pick<K extends "noise" | "texture" | "glass">(base: object, key: K): object {
  return key in base ? (base as Record<K, object>)[key] : {};
}

/** Figma's noise from the tool's values: the second colour for duo, the opacity for multi. */
function noiseOf(noise: {
  readonly type: keyof typeof NOISE_TYPES;
  readonly size: number;
  readonly density: number;
  readonly color: string;
  readonly secondColor: string;
  readonly opacity: number;
}): NonNullable<Effects["noise"]> {
  const noiseType = NOISE_TYPES[noise.type];

  return {
    noiseType,
    noiseSize: noise.size,
    density: noise.density,
    color: channelsOf("noise.color", noise.color),
    ...(noiseType === "DUOTONE" ? { secondaryColor: channelsOf("noise.secondColor", noise.secondColor) } : {}),
    ...(noiseType === "MULTITONE" ? { opacity: noise.opacity } : {}),
  };
}

function channelsOf(field: string, css: string): { r: number; g: number; b: number; a: number } {
  const color = Color.parse(css);

  if (color === null) {
    throw new BridgeError("OP_FAILED", `${field} "${css}" is not a CSS colour: give a hex, rgb() or a colour name.`);
  }

  return color.channels();
}
