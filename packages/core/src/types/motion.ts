import type { SnapshotNode } from "./snapshot.ts";

export type SnapshotMotion = NonNullable<SnapshotNode["motion"]>;
export type MotionTrack = SnapshotMotion["tracks"][number];
export type MotionKeyframe = MotionTrack["keyframes"][number];
export type MotionEasing = MotionKeyframe["easing"];

/** An animated layer in design_read's motion: its id, name, the CSS class its rule uses, and its tracks as read. */
export interface MotionLayer {
  readonly id: string;
  readonly name: string;
  readonly class: string;
  readonly tracks: readonly MotionTrack[];
}

/** design_read's motion: the timeline's length, the CSS (@keyframes and a rule per layer), and the layers. */
export interface MotionView {
  readonly timeline: string;
  readonly css: string;
  readonly layers: readonly MotionLayer[];
}
