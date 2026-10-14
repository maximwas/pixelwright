import { type Channels, Color, isChannels } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { decimal } from "../../kernel/numbers.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { nameOf, summaryOf } from "./track-summary.ts";
import { componentOf, cssPoints, lengthCss, type Point, sample } from "./tracks.ts";
import type { MotionEasing, MotionTrack, SnapshotMotion } from "./types.ts";
import { MOTION_AXES, MOTION_PROPERTIES, MOTION_UNCOVERED } from "./vocabulary.ts";

/** A keyframe of a CSS property: its time, its value as CSS, and the easing that leaves it. */
export interface ChannelPoint {
  readonly t: number;
  readonly css: string;
  readonly easing: MotionEasing;
}

/** One CSS property's keyframes on a layer. */
export interface Channel {
  readonly property: string;
  readonly points: ChannelPoint[];
}

/** A layer's motion as CSS: a channel per property, and comments for what CSS cannot animate. */
export interface LayerChannels {
  readonly channels: readonly Channel[];
  readonly comments: readonly string[];
}

/** The properties that join their axes' tracks into one value. */
type AxisProperty = "translate" | "scale";

/** An axis track of translate or scale: the axis it moves, and its keyframes. */
interface AxisTrack {
  readonly axis: "x" | "y" | "xy";
  readonly points: readonly Point[];
}

/** How a track's keyframes are written: the property they animate, and a keyframe value as CSS. */
interface Writing {
  readonly property: string;
  readonly css: (value: unknown) => string;
}

/** The layer's tracks as CSS properties, in the order the tracks come, and comments for what CSS cannot animate. */
export function channelsOf(node: SnapshotNode, motion: SnapshotMotion, space: ColorSpace): LayerChannels {
  const channels = new ChannelSet(node, space);

  for (const track of motion.tracks) {
    channels.add(track);
  }

  return channels.build();
}

/** Builds a layer's channels track by track: translate and scale wait for all their axes, the rest go in at once. */
class ChannelSet {
  readonly #node: SnapshotNode;
  readonly #space: ColorSpace;
  readonly #channels = new Map<string, Channel>();
  readonly #axes = new Map<AxisProperty, AxisTrack[]>();
  readonly #comments: string[] = [];

  constructor(node: SnapshotNode, space: ColorSpace) {
    this.#node = node;
    this.#space = space;
  }

  add(track: MotionTrack): void {
    const points = cssPoints(track);
    const axis = MOTION_AXES[track.field];

    if (track.unplaced) {
      this.#comments.push(
        `${nameOf(this.#node, track)}: Figma gives these keyframes from their animation style's start, not the timeline's: delay them by when the style starts`,
      );
    }

    if (axis !== undefined) {
      // Its place among the channels is where its first axis comes.
      this.#channel(axis.property);
      this.#axes.set(axis.property, [
        ...(this.#axes.get(axis.property) ?? []),
        {
          axis: axis.axis,
          points,
        },
      ]);

      return;
    }

    const writing = this.#writingOf(track, points);

    if (writing === null) {
      this.#comments.push(uncoveredComment(this.#node, track, this.#space));

      return;
    }

    this.#channel(writing.property).points.push(
      ...points.map((point) => ({
        t: point.t,
        css: writing.css(point.value),
        easing: point.easing,
      })),
    );
  }

  /** The channels with keyframes, translate and scale with their axes joined, and the comments. */
  build(): LayerChannels {
    for (const [property, tracks] of this.#axes) {
      this.#channel(property).points.push(...axisPoints(property, tracks));
    }

    this.#axes.clear();

    return {
      channels: [...this.#channels.values()].filter((channel) => channel.points.length > 0),
      comments: this.#comments,
    };
  }

  #channel(property: string): Channel {
    const found = this.#channels.get(property);

    if (found !== undefined) {
      return found;
    }

    const made: Channel = {
      property,
      points: [],
    };

    this.#channels.set(property, made);

    return made;
  }

  /** The property a track animates on its own and how its values are written; null when CSS has none for it. */
  #writingOf(track: MotionTrack, points: readonly Point[]): Writing | null {
    const numbers = points.every((point) => typeof point.value === "number");
    const own = MOTION_PROPERTIES[track.field];

    if (track.field === "ROTATION" && numbers) {
      return {
        property: "rotate",
        css: (value) => `${decimal(-(value as number))}deg`,
      };
    }

    if (own !== undefined && numbers) {
      return {
        property: own.property,
        css: (value) => (own.length ? lengthCss(value as number) : decimal(value as number)),
      };
    }

    const paint = paintProperty(this.#node, track, points);

    return paint === null
      ? null
      : {
          property: paint,
          css: (value) => Color.of(value as Channels, this.#space).css(),
        };
  }
}

/** translate or scale at every time any of its axes has a keyframe, an axis between its keyframes taken linearly. */
function axisPoints(property: AxisProperty, tracks: readonly AxisTrack[]): ChannelPoint[] {
  const rest = property === "translate" ? 0 : 1;
  const times = [...new Set(tracks.flatMap((track) => track.points.map((point) => point.t)))].sort((a, b) => a - b);
  const axisValue = (axis: "x" | "y", t: number) => {
    const own = tracks.find((track) => track.axis === axis) ?? tracks.find((track) => track.axis === "xy");
    const points = (own?.points ?? []).flatMap((point) => {
      const value = componentOf(point.value, axis);

      return value === null
        ? []
        : [
            {
              t: point.t,
              value,
            },
          ];
    });

    return points.length === 0 ? rest : sample(points, t);
  };

  return times.map((t) => {
    const x = axisValue("x", t);
    const y = axisValue("y", t);
    const easing =
      tracks.flatMap((track) => track.points.filter((point) => point.t === t))[0]?.easing ??
      ({ type: "LINEAR" } as MotionEasing);

    return {
      t,
      css:
        property === "translate"
          ? `${lengthCss(x)} ${lengthCss(y)}`
          : x === y
            ? decimal(x)
            : `${decimal(x)} ${decimal(y)}`,
      easing,
    };
  });
}

/** The CSS colour property a paint track animates: background, a text's color, a border's colour. */
function paintProperty(node: SnapshotNode, track: MotionTrack, points: readonly Point[]): string | null {
  const [collection] = track.field.split(".");

  if (!/^(fills|strokes)\.\d+$/.test(track.field) || !points.every((point) => isChannels(point.value))) {
    return null;
  }

  return collection === "strokes" ? "border-color" : node.type === "TEXT" ? "color" : "background-color";
}

/** What CSS cannot animate as a property, said with how a build could do it instead. */
function uncoveredComment(node: SnapshotNode, track: MotionTrack, space: ColorSpace): string {
  const how =
    MOTION_UNCOVERED[track.field] ??
    MOTION_UNCOVERED[track.field.split(".")[0] ?? ""] ??
    (track.base.type === "TEXT_DATA" ? MOTION_UNCOVERED.TEXT_DATA : undefined) ??
    "no CSS property animates this";

  return `${summaryOf(node, track, space).change}: ${how}`;
}
