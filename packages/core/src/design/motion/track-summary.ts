import { Color, isChannels } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { decimal } from "../../kernel/numbers.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { cssPoints, isVector, keyframeEasing } from "./tracks.ts";
import type { MotionEasing, MotionTrack } from "./types.ts";
import { MOTION_AXES, MOTION_NAMES, MOTION_PROPERTIES, MOTION_SPRINGS } from "./vocabulary.ts";

/** A track in words: what changes from what to what, when and how, and whether it changes at all. */
export interface TrackSummary {
  readonly change: string;
  readonly timing: string;
  readonly moves: boolean;
}

/** A track's change and timing in words, and whether its value changes at all. */
export function summaryOf(node: SnapshotNode, track: MotionTrack, space: ColorSpace): TrackSummary {
  const points = cssPoints(track);
  const rotation = track.field === "ROTATION";
  const values = points
    .map((point) => valueText(rotation && typeof point.value === "number" ? -point.value : point.value, space))
    .filter((value, index, all) => index === 0 || value !== all[index - 1]);
  const unit =
    MOTION_PROPERTIES[track.field]?.length || MOTION_AXES[track.field]?.property === "translate"
      ? "px"
      : rotation
        ? "deg"
        : "";
  const first = points[0];
  const last = points.at(-1);
  const range =
    first === undefined || last === undefined
      ? ""
      : first.t === last.t
        ? `at ${decimal(first.t)}s`
        : `${decimal(first.t)}–${decimal(last.t)}s`;
  const easings = new Set(points.slice(0, -1).map((point) => easingWord(point.easing)));
  const [easing] = easings;
  const how = easings.size > 1 ? "mixed easing" : (easing ?? "");

  return {
    change: `${nameOf(node, track)} ${values.join("→")}${unit}`,
    timing: [range, how, track.unplaced ? "after its style's start" : ""].filter((part) => part !== "").join(" "),
    moves: values.length > 1,
  };
}

/** What a track animates, in CSS's words where CSS has one. */
export function nameOf(node: SnapshotNode, track: MotionTrack): string {
  const [collection, index] = track.field.split(".");
  const painted = index !== undefined && /^\d+$/.test(index);

  if (collection === "fills" && painted) {
    return node.type === "TEXT" ? "color" : "background";
  }

  if (collection === "strokes" && painted) {
    return "border-color";
  }

  return (
    MOTION_NAMES[track.field] ??
    MOTION_PROPERTIES[track.field]?.property ??
    track.field.toLowerCase().replaceAll("_", "-").replaceAll(".", " ")
  );
}

/** An easing in a summary's words: a hold, a spring by its name, else as CSS writes it. */
function easingWord(easing: MotionEasing): string {
  if (easing.type === "HOLD") {
    return "hold";
  }

  return MOTION_SPRINGS.has(easing.type) && easing.bezier === undefined ? springName(easing) : keyframeEasing(easing);
}

function springName(easing: MotionEasing): string {
  return easing.type === "CUSTOM_SPRING"
    ? `spring${easing.bounce === undefined ? "" : `, bounce ${decimal(easing.bounce)}`}`
    : `${easing.type.toLowerCase()} spring`;
}

function valueText(value: unknown, space: ColorSpace): string {
  if (typeof value === "number") {
    return decimal(value);
  }

  if (isVector(value)) {
    return `(${decimal(value.x)}, ${decimal(value.y)})`;
  }

  if (isChannels(value)) {
    return Color.of(value, space).css();
  }

  return JSON.stringify(value);
}
