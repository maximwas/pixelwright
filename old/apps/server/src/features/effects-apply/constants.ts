import type { EffectValues } from "./schemas.ts";

/** The values an effect takes where neither the call nor its preset gives one. */
export const EFFECT_DEFAULTS = {
  noise: {
    type: "mono",
    size: 1,
    density: 0.55,
    color: "rgba(0, 0, 0, 0.22)",
    secondColor: "rgba(255, 255, 255, 0.25)",
    opacity: 0.3,
  },
  texture: {
    size: 6,
    radius: 10,
    clip: true,
  },
  glass: {
    light: 0.5,
    angle: -45,
    refraction: 0.3,
    depth: 12,
    dispersion: 0.1,
    blur: 12,
  },
} as const satisfies Required<{ [K in keyof EffectValues]-?: Required<NonNullable<EffectValues[K]>> }>;

/** Ready looks: a name and the effect values it stands for, any of which the call may change. */
export const EFFECT_PRESETS = {
  /** Fine dark grain, for a flat colour or a gradient that looks too clean (on a dark layer, give a light noise.color). */
  grain: {
    noise: {
      type: "mono",
      size: 1,
      density: 0.55,
      color: "rgba(0, 0, 0, 0.22)",
    },
  },
  /** Black and white grain, as on film. */
  film: {
    noise: {
      type: "duo",
      size: 1.5,
      density: 0.7,
      color: "rgba(0, 0, 0, 0.3)",
      secondColor: "rgba(255, 255, 255, 0.25)",
    },
  },
  /** Grain of many colours, as a risograph print. */
  risograph: {
    noise: {
      type: "multi",
      size: 2,
      density: 0.4,
      color: "#000000",
      opacity: 0.35,
    },
  },
  /** Frosted glass over what lies behind it, on a frame. */
  "frosted-glass": {
    glass: {
      light: 0.5,
      angle: -45,
      refraction: 0.3,
      depth: 12,
      dispersion: 0.1,
      blur: 12,
    },
  },
  /** Clear glass that bends what lies behind it, on a frame. */
  "clear-glass": {
    glass: {
      light: 0.8,
      angle: -45,
      refraction: 0.8,
      depth: 24,
      dispersion: 0.4,
      blur: 2,
    },
  },
} as const satisfies Record<string, EffectValues>;

export const PRESET_NAMES = Object.keys(EFFECT_PRESETS) as [
  keyof typeof EFFECT_PRESETS,
  ...(keyof typeof EFFECT_PRESETS)[],
];
