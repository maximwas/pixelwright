import type { GRADIENT_KIND, GRADIENT_UNIT } from "@/core/css/gradients/gradients.constants.ts";
import type { ColorValue } from "@/core/kernel/color/color.ts";

/** Figma's gradientTransform: a 2 x 3 affine map from the layer's unit square to the gradient's space. */
export type GradientTransform = readonly [readonly [number, number, number], readonly [number, number, number]];

/** A layer's size, which a gradient's CSS and Figma's transform are related through. */
export interface Box {
  readonly width: number;
  readonly height: number;
}

/** A centre's or a radius's length on one axis: px, or a percent of the box. */
export interface GradientLength {
  readonly value: number;
  readonly unit: (typeof GRADIENT_UNIT)[keyof typeof GRADIENT_UNIT];
}

export interface GradientPoint {
  readonly x: GradientLength;
  readonly y: GradientLength;
}

/** A stop as Figma takes it: a colour, or a colour variable's token (faded by `opacity`), at its place 0 to 1. */
export interface GradientStopSpec {
  readonly color: ColorValue | null;
  readonly token?: string;
  readonly opacity?: number;
  readonly position: number;
}

type Kind = typeof GRADIENT_KIND;

/** A CSS gradient as Figma can paint it. */
export type GradientSpec =
  | { readonly type: Kind["linear"]; readonly angle: number; readonly stops: readonly GradientStopSpec[] }
  | {
    readonly type: Kind["radial"];
    readonly center: GradientPoint;
    readonly radii: GradientPoint | null;
    readonly stops: readonly GradientStopSpec[];
  }
  | {
    readonly type: Kind["angular"];
    readonly angle: number;
    readonly center: GradientPoint;
    readonly stops: readonly GradientStopSpec[];
  };
