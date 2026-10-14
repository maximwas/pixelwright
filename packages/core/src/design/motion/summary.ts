import type { ColorSpace } from "../../kernel/color/color-space.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { summaryOf, type TrackSummary } from "./track-summary.ts";

/**
 * What a layer's Figma Motion does, for its `$motion`: what changes, from and to, when and how —
 * `opacity 0→1, translate-y 24→0px; 0–0.6s ease-out`, led by the animation styles that made it.
 */
export function motionSummary(node: SnapshotNode, space: ColorSpace = "srgb"): string | undefined {
  const motion = node.motion;

  if (motion === undefined) {
    return undefined;
  }

  const parts = motion.tracks.map((track) => summaryOf(node, track, space));
  const moving = parts.filter((part) => part.moves);
  const body = bodyOf(moving.length > 0 ? moving : parts);
  const styles = [
    ...new Set([
      ...motion.tracks.flatMap((track) => (track.style === undefined ? [] : [track.style])),
      ...motion.styles.map((style) => style.name),
    ]),
  ].map(styleTitle);

  if (body === "") {
    return styles.length === 0 ? undefined : styles.join(", ");
  }

  return styles.length === 0 ? body : `${styles.join(", ")}: ${body}`;
}

/** The tracks' changes with one timing when they share it, else each with its own. */
function bodyOf(shown: readonly TrackSummary[]): string {
  const [first] = shown;

  if (first === undefined) {
    return "";
  }

  return shown.every((part) => part.timing === first.timing)
    ? `${shown.map((part) => part.change).join(", ")}; ${first.timing}`
    : shown.map((part) => `${part.change} ${part.timing}`).join(", ");
}

/** An animation style's name in words: Figma's own are keys like `motion.preset_name.text_stagger`. */
function styleTitle(name: string): string {
  const words = name.replace(/^motion\.preset_name\./, "").replaceAll("_", " ");

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
