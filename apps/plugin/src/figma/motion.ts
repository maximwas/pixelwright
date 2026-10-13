import type { MotionTrack, MotionEasing as SnapshotEasing, SnapshotMotion } from "@pixelwright/core";
import { MOTION_STYLE_FIELDS } from "../constants/motion.ts";

interface RawTrack {
  readonly id: string;
  readonly keyframeOperation: string;
  readonly keyframes: readonly ManualKeyframe[];
}

interface RawBinding {
  readonly baseValue: KeyframeValue;
  readonly tracks: readonly RawTrack[];
}

/**
 * The layer's Figma Motion (a beta API): its animation styles and every keyframe track. Figma gives a style's
 * keyframes from 0, so a track a style made moves to where the style starts on the timeline; a manual track's
 * keyframes are on the timeline already. Undefined where Figma has no Motion API or nothing on the layer animates.
 */
export function motionOf(node: SceneNode): SnapshotMotion | undefined {
  if ((figma as { motion?: unknown }).motion === undefined || !("animations" in node)) {
    return undefined;
  }

  const styles = node.animationStyles.map((style) => ({
    type: style.type,
    name: style.name,
    start: round(style.timelineOffset ?? 0),
    ...("duration" in style && style.duration !== undefined ? { duration: round(style.duration) } : {}),
  }));
  const manual = new Set(bindingsOf(node.manualKeyframeTracks).map(([, binding]) => binding.id));
  const tracks: MotionTrack[] = bindingsOf(node.animations).flatMap(([field, binding]) =>
    (binding as unknown as RawBinding).tracks.map((track) => {
      const style = manual.has(track.id) ? undefined : styleOf(field, node.animationStyles);

      return {
        field,
        operation: track.keyframeOperation,
        base: keyframeValue((binding as unknown as RawBinding).baseValue),
        ...(style === undefined ? {} : { style: style.name }),
        keyframes: track.keyframes.map((keyframe) => ({
          t: round(keyframe.timelinePosition + (style?.timelineOffset ?? 0)),
          value: keyframeValue(keyframe.value),
          easing: easingOf(keyframe.easing),
        })),
      };
    }),
  );
  const [timeline] = node.timelines;

  if (styles.length === 0 && tracks.length === 0) {
    return undefined;
  }

  return {
    ...(timeline === undefined ? {} : { timeline: round(timeline.duration) }),
    styles,
    tracks,
  };
}

/** Every binding with its field: a property (`OPACITY`), a paint (`fills.0`), an effect's parameter (`effects.0.RADIUS`). */
function bindingsOf(animations: object): [string, { readonly id?: string }][] {
  return Object.entries(animations).flatMap(([key, value]: [string, unknown]) => {
    if (value === undefined || value === null) {
      return [];
    }

    if (key === "fills" || key === "strokes") {
      return Object.entries(value as object).flatMap(([index, binding]: [string, unknown]) =>
        isBinding(binding) ? [[`${key}.${index}`, binding] as [string, { readonly id?: string }]] : [],
      );
    }

    if (key === "effects") {
      return Object.entries(value as object).flatMap(([index, fields]: [string, unknown]) =>
        Object.entries((fields ?? {}) as object).flatMap(([name, binding]: [string, unknown]) =>
          name !== "properties" && isBinding(binding)
            ? [[`effects.${index}.${name}`, binding] as [string, { readonly id?: string }]]
            : [],
        ),
      );
    }

    return isBinding(value) ? [[key, value as { readonly id?: string }] as [string, { readonly id?: string }]] : [];
  });
}

/** A binding of keyframes, not a component property's map of them. */
function isBinding(value: unknown): value is { readonly id?: string } {
  return typeof value === "object" && value !== null && "baseValue" in value;
}

/** The animation style that made a track of this field: the first of Figma's styles that animates it. */
function styleOf(field: string, styles: readonly AppliedAnimationStyle[]): AppliedAnimationStyle | undefined {
  return styles.find((style) =>
    (MOTION_STYLE_FIELDS[style.name.replace(/^motion\.preset_name\./, "")] ?? []).includes(field),
  );
}

/** A keyframe's easing: its type, its curve and a spring's bounce when Figma gives them; a variable's, by type only. */
function easingOf(easing: ManualKeyframe["easing"]): SnapshotEasing {
  if (easing.type === "VARIABLE_ALIAS") {
    return { type: "VARIABLE_ALIAS" };
  }

  const bezier = easing.easingFunctionCubicBezier;

  return {
    type: easing.type,
    ...(bezier === undefined ? {} : { bezier: [bezier.x1, bezier.y1, bezier.x2, bezier.y2].map(round) }),
    ...(easing.easingFunctionSpring === undefined ? {} : { bounce: round(easing.easingFunctionSpring.bounce) }),
  };
}

/** A keyframe value with its numbers rounded as a snapshot rounds them. */
function keyframeValue(value: KeyframeValue): { type: string; value: unknown } {
  return {
    type: value.type,
    value: rounded(value.value),
  };
}

function rounded(value: unknown): unknown {
  if (typeof value === "number") {
    return round(value);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, rounded(inner)]));
  }

  return value;
}

/** Four decimals: Figma keeps times and values as floats (0.4000000059604645). */
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
