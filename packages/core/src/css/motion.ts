import {
  CSS_EASING_KEYWORDS,
  MOTION_AXES,
  MOTION_BEZIERS,
  MOTION_NAMES,
  MOTION_PROPERTIES,
  MOTION_SPRINGS,
  MOTION_UNCOVERED,
} from "../constants/motion.ts";
import type { MotionEasing, MotionLayer, MotionTrack, MotionView, SnapshotMotion } from "../types/motion.ts";
import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import { slug } from "../utils/slug.ts";
import { colorCss, type Rgba } from "./color.ts";
import { decimal } from "./format.ts";

/** A keyframe with its value made absolute from the track's base. */
interface Point {
  readonly t: number;
  readonly value: unknown;
  readonly easing: MotionEasing;
}

/** One CSS property's keyframes on a layer: the value at each time, and the easing that leaves it. */
interface Channel {
  readonly property: string;
  readonly points: { t: number; css: string; easing: MotionEasing }[];
}

/** A keyframe block's line: its percentage, a property's value, and the easing that leaves it (null: linear). */
interface Entry {
  readonly percent: number;
  readonly declaration: string;
  readonly easing: string | null;
}

/**
 * What a layer's Figma Motion does, for its `$motion`: what changes, from and to, when and how —
 * `opacity 0→1, translate-y 24→0px; 0–0.6s ease-out`, led by the animation styles that made it.
 */
export function motionSummary(node: SnapshotNode): string | undefined {
  const motion = node.motion;

  if (motion === undefined) {
    return undefined;
  }

  const parts = motion.tracks.map((track) => summaryOf(node, track));
  const moving = parts.filter((part) => part.moves);
  const shown = moving.length > 0 ? moving : parts;
  const styles = [
    ...new Set([
      ...motion.tracks.flatMap((track) => (track.style === undefined ? [] : [track.style])),
      ...motion.styles.map((style) => style.name),
    ]),
  ].map(styleTitle);
  const [first] = shown;
  const body =
    first === undefined
      ? ""
      : shown.every((part) => part.timing === first.timing)
        ? `${shown.map((part) => part.change).join(", ")}; ${first.timing}`
        : shown.map((part) => `${part.change} ${part.timing}`).join(", ");

  if (body === "") {
    return styles.length === 0 ? undefined : styles.join(", ");
  }

  return styles.length === 0 ? body : `${styles.join(", ")}: ${body}`;
}

/**
 * The read's Figma Motion as CSS: per animated layer one `@keyframes`, named from the layer, whose percentages are
 * each keyframe's time over the timeline, and a rule running it over the whole timeline. What CSS cannot animate as a
 * property is said in a comment. Null when no layer is animated.
 */
export function designMotion(snapshot: Snapshot): MotionView | null {
  const layers: MotionLayer[] = [];
  const css: string[] = [];
  const classes = new Set<string>();
  let timeline: string | null = null;

  const visit = (node: SnapshotNode) => {
    const motion = node.motion;

    if (motion !== undefined && motion.tracks.length > 0) {
      const name = classOf(node.name, classes);
      const duration = durationOf(motion);

      classes.add(name);
      timeline ??= `${decimal(duration)}s`;
      css.push(layerCss(node, motion, name, duration));
      layers.push({
        id: node.id,
        name: node.name,
        class: name,
        tracks: motion.tracks,
      });
    }

    node.children?.forEach(visit);
  };

  visit(snapshot.root);

  return timeline === null
    ? null
    : {
        timeline,
        css: css.join("\n\n"),
        layers,
      };
}

function layerCss(node: SnapshotNode, motion: SnapshotMotion, name: string, duration: number): string {
  const { channels, comments } = channelsOf(node, motion);
  const notes = comments.map((comment) => `/* ${comment.replaceAll("*/", "* /")} */`);

  if (channels.length === 0) {
    return notes.map((note) => note.replace("/* ", `/* ${node.name}: `)).join("\n");
  }

  const entries = channels.flatMap((channel) => entriesOf(channel, duration));
  const byPercent = new Map<number, Map<string, Entry[]>>();

  for (const entry of entries) {
    const groups = byPercent.get(entry.percent) ?? new Map<string, Entry[]>();
    const key = entry.easing ?? "";

    groups.set(key, [...(groups.get(key) ?? []), entry]);
    byPercent.set(entry.percent, groups);
  }

  const blocks = [...byPercent]
    .sort(([a], [b]) => a - b)
    .flatMap(([percent, groups]) =>
      [...groups].map(([easing, group]) => {
        const lines = [
          ...group.map((entry) => entry.declaration),
          ...(easing === "" ? [] : [`animation-timing-function: ${easing}`]),
        ];

        return `  ${decimal(percent)}% { ${lines.join("; ")}; }`;
      }),
    );

  return [
    `@keyframes ${name} {`,
    ...notes.map((note) => `  ${note}`),
    ...blocks,
    "}",
    `.${name} { animation: ${name} ${decimal(duration)}s linear both; }`,
  ].join("\n");
}

/** A channel's keyframe lines, held at its first value from 0% and its last to 100%, as Figma holds them. */
function entriesOf(channel: Channel, duration: number): Entry[] {
  const byTime = new Map(channel.points.map((point) => [point.t, point]));
  const points = [...byTime.values()].sort((a, b) => a.t - b.t);
  const percentOf = (t: number) => (duration > 0 ? Math.min(100, Math.round((t / duration) * 10_000) / 100) : 0);
  const entries = new Map<number, Entry>();

  points.forEach((point, index) => {
    const easing = index === points.length - 1 ? "linear" : easingCss(point.easing);
    const percent = percentOf(point.t);

    entries.set(percent, {
      percent,
      declaration: `${channel.property}: ${point.css}`,
      easing: easing === "linear" ? null : easing,
    });
  });

  const first = points[0];
  const last = points.at(-1);

  for (const [percent, point] of [
    [0, first],
    [100, last],
  ] as const) {
    if (point !== undefined && !entries.has(percent)) {
      entries.set(percent, {
        percent,
        declaration: `${channel.property}: ${point.css}`,
        easing: null,
      });
    }
  }

  return [...entries.values()];
}

/** The layer's tracks as CSS properties, in the order the tracks come, and comments for what CSS cannot animate. */
function channelsOf(node: SnapshotNode, motion: SnapshotMotion): { channels: Channel[]; comments: string[] } {
  const channels = new Map<string, Channel>();
  const axes = new Map<"translate" | "scale", { axis: "x" | "y" | "xy"; points: Point[] }[]>();
  const comments: string[] = [];
  const channel = (property: string) => {
    const found = channels.get(property);

    if (found !== undefined) {
      return found;
    }

    const made: Channel = {
      property,
      points: [],
    };

    channels.set(property, made);

    return made;
  };

  for (const track of motion.tracks) {
    const points = cssPoints(track);
    const axis = MOTION_AXES[track.field];

    if (track.unplaced) {
      comments.push(
        `${nameOf(node, track)}: Figma gives these keyframes from their animation style's start, not the timeline's: delay them by when the style starts`,
      );
    }

    const own = MOTION_PROPERTIES[track.field];
    const paint = paintProperty(node, track, points);

    if (axis !== undefined) {
      channel(axis.property);
      axes.set(axis.property, [
        ...(axes.get(axis.property) ?? []),
        {
          axis: axis.axis,
          points,
        },
      ]);
    } else if (track.field === "ROTATION" && points.every((point) => typeof point.value === "number")) {
      channel("rotate").points.push(
        ...points.map((point) => ({
          t: point.t,
          css: `${decimal(-(point.value as number))}deg`,
          easing: point.easing,
        })),
      );
    } else if (own !== undefined && points.every((point) => typeof point.value === "number")) {
      channel(own.property).points.push(
        ...points.map((point) => ({
          t: point.t,
          css: own.length ? length(point.value as number) : decimal(point.value as number),
          easing: point.easing,
        })),
      );
    } else if (paint !== null) {
      channel(paint).points.push(
        ...points.map((point) => ({
          t: point.t,
          css: colorCss(point.value as Rgba),
          easing: point.easing,
        })),
      );
    } else {
      const summary = summaryOf(node, track);
      const how =
        MOTION_UNCOVERED[track.field] ??
        MOTION_UNCOVERED[track.field.split(".")[0] ?? ""] ??
        (track.base.type === "TEXT_DATA" ? MOTION_UNCOVERED.TEXT_DATA : undefined) ??
        "no CSS property animates this";

      comments.push(`${summary.change}: ${how}`);
    }
  }

  for (const [property, tracks] of axes) {
    channel(property).points.push(...axisPoints(property, tracks));
  }

  return {
    channels: [...channels.values()].filter((made) => made.points.length > 0),
    comments,
  };
}

/** translate or scale at every time any of its axes has a keyframe, an axis between its keyframes taken linearly. */
function axisPoints(
  property: "translate" | "scale",
  tracks: readonly { axis: "x" | "y" | "xy"; points: Point[] }[],
): Channel["points"] {
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
        property === "translate" ? `${length(x)} ${length(y)}` : x === y ? decimal(x) : `${decimal(x)} ${decimal(y)}`,
      easing,
    };
  });
}

/** The CSS colour property a paint track animates: background, a text's color, a border's colour. */
function paintProperty(node: SnapshotNode, track: MotionTrack, points: readonly Point[]): string | null {
  const [collection] = track.field.split(".");

  if (!/^(fills|strokes)\.\d+$/.test(track.field) || !points.every((point) => isRgba(point.value))) {
    return null;
  }

  return collection === "strokes" ? "border-color" : node.type === "TEXT" ? "color" : "background-color";
}

/** A track's change and timing in words, and whether its value changes at all. */
function summaryOf(node: SnapshotNode, track: MotionTrack): { change: string; timing: string; moves: boolean } {
  const points = cssPoints(track);
  const rotation = track.field === "ROTATION";
  const values = points
    .map((point) => valueText(rotation && typeof point.value === "number" ? -point.value : point.value))
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

function nameOf(node: SnapshotNode, track: MotionTrack): string {
  const [collection, index] = track.field.split(".");

  if (collection === "fills" && index !== undefined && /^\d+$/.test(index)) {
    return node.type === "TEXT" ? "color" : "background";
  }

  if (collection === "strokes" && index !== undefined && /^\d+$/.test(index)) {
    return "border-color";
  }

  return (
    MOTION_NAMES[track.field] ??
    MOTION_PROPERTIES[track.field]?.property ??
    track.field.toLowerCase().replaceAll("_", "-").replaceAll(".", " ")
  );
}

/**
 * The values CSS animates: for translate and rotate the change from the layer's own place and angle (Figma's base is
 * the layer's x, y and rotation, which its layout and transform already give); else the value itself.
 */
function cssPoints(track: MotionTrack): Point[] {
  const points = pointsOf(track);

  if (track.field !== "ROTATION" && MOTION_AXES[track.field]?.property !== "translate") {
    return points;
  }

  return points.map((point) => ({
    ...point,
    value: combine(point.value, track.base.value, (value, base) => value - base),
  }));
}

/** A track's keyframes in time order, each value made absolute: OFFSET adds it to the base, SCALE multiplies it. */
function pointsOf(track: MotionTrack): Point[] {
  const base = track.base.value;

  return [...track.keyframes]
    .sort((a, b) => a.t - b.t)
    .map(({ t, value, easing }) => ({
      t,
      value:
        track.operation === "OFFSET"
          ? combine(base, value.value, (a, b) => a + b)
          : track.operation === "SCALE"
            ? combine(base, value.value, (a, b) => a * b)
            : value.value,
      easing,
    }));
}

function combine(base: unknown, value: unknown, operation: (a: number, b: number) => number): unknown {
  if (typeof base === "number" && typeof value === "number") {
    return operation(base, value);
  }

  if (isVector(base) && isVector(value)) {
    return {
      x: operation(base.x, value.x),
      y: operation(base.y, value.y),
    };
  }

  return value;
}

/** The timeline's length; without one (or a zero one), the latest keyframe's time. */
function durationOf(motion: SnapshotMotion): number {
  if (motion.timeline !== undefined && motion.timeline > 0) {
    return motion.timeline;
  }

  return Math.max(0, ...motion.tracks.flatMap((track) => track.keyframes.map((keyframe) => keyframe.t)));
}

/** A value between two keyframes, taken linearly; held before the first and after the last. */
function sample(points: readonly { t: number; value: number }[], t: number): number {
  const after = points.findIndex((point) => point.t >= t);
  const next = points[after];
  const previous = points[after - 1];

  if (next === undefined) {
    return points.at(-1)?.value ?? 0;
  }

  if (previous === undefined || next.t === t) {
    return next.value;
  }

  return previous.value + ((next.value - previous.value) * (t - previous.t)) / (next.t - previous.t);
}

function componentOf(value: unknown, axis: "x" | "y"): number | null {
  if (typeof value === "number") {
    return value;
  }

  return isVector(value) ? value[axis] : null;
}

/** A keyframe's easing as CSS: a keyword when CSS has one, else cubic-bezier(); a hold steps; a spring eases out. */
function easingCss(easing: MotionEasing): string {
  if (easing.type === "HOLD") {
    return "steps(1, end)";
  }

  const bezier = easing.bezier ?? MOTION_BEZIERS[easing.type];

  if (bezier?.length === 4) {
    const numbers = bezier.map(decimal).join(", ");

    return CSS_EASING_KEYWORDS[numbers] ?? `cubic-bezier(${numbers})`;
  }

  return MOTION_SPRINGS.has(easing.type) ? `ease-out /* Figma's ${springName(easing)} */` : "linear";
}

/** An easing in a summary's words: a hold, a spring by its name, else as CSS writes it. */
function easingWord(easing: MotionEasing): string {
  if (easing.type === "HOLD") {
    return "hold";
  }

  return MOTION_SPRINGS.has(easing.type) && easing.bezier === undefined ? springName(easing) : easingCss(easing);
}

function springName(easing: MotionEasing): string {
  return easing.type === "CUSTOM_SPRING"
    ? `spring${easing.bounce === undefined ? "" : `, bounce ${decimal(easing.bounce)}`}`
    : `${easing.type.toLowerCase()} spring`;
}

/** An animation style's name in words: Figma's own are keys like `motion.preset_name.text_stagger`. */
function styleTitle(name: string): string {
  const words = name.replace(/^motion\.preset_name\./, "").replaceAll("_", " ");

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/** A CSS class from the layer's name, never with a digit first, suffixed when another layer took it. */
function classOf(name: string, taken: ReadonlySet<string>): string {
  const base = slug(name);
  const safe = /^\d/.test(base) ? `layer-${base}` : base;
  let candidate = safe;

  for (let index = 2; taken.has(candidate); index++) {
    candidate = `${safe}-${index}`;
  }

  return candidate;
}

function valueText(value: unknown): string {
  if (typeof value === "number") {
    return decimal(value);
  }

  if (isVector(value)) {
    return `(${decimal(value.x)}, ${decimal(value.y)})`;
  }

  if (isRgba(value)) {
    return colorCss(value);
  }

  return JSON.stringify(value);
}

function length(value: number): string {
  return value === 0 ? "0" : `${decimal(value)}px`;
}

function isVector(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { x?: unknown }).x === "number" &&
    typeof (value as { y?: unknown }).y === "number"
  );
}

function isRgba(value: unknown): value is Rgba {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Rgba).r === "number" &&
    typeof (value as Rgba).g === "number" &&
    typeof (value as Rgba).b === "number"
  );
}
