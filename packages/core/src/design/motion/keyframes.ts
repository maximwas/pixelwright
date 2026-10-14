import { type ColorSpace, colorSpaceOf } from "../../kernel/color/color-space.ts";
import { decimal } from "../../kernel/numbers.ts";
import type { Snapshot, SnapshotNode } from "../../types/snapshot.ts";
import { slug } from "../../utils/slug.ts";
import { type Channel, channelsOf } from "./channels.ts";
import { durationOf, keyframeEasing } from "./tracks.ts";
import type { MotionView, SnapshotMotion } from "./types.ts";

/** A keyframe block's line: its percentage, a property's value, and the easing that leaves it (null: linear). */
interface Entry {
  readonly percent: number;
  readonly declaration: string;
  readonly easing: string | null;
}

/** A layer whose motion has tracks. */
interface Animated {
  readonly node: SnapshotNode;
  readonly motion: SnapshotMotion;
}

/** What a layer's keyframes are written with: its class, its duration, and the file's colour space. */
interface Rule {
  readonly name: string;
  readonly duration: number;
  readonly space: ColorSpace;
}

/**
 * The read's Figma Motion as CSS: per animated layer one `@keyframes`, named from the layer, whose percentages are
 * each keyframe's time over the timeline, and a rule running it over the whole timeline. What CSS cannot animate as a
 * property is said in a comment. Null when no layer is animated.
 */
export function designMotion(snapshot: Snapshot): MotionView | null {
  const animated = animatedOf(snapshot.root);
  const [first] = animated;

  if (first === undefined) {
    return null;
  }

  const space = colorSpaceOf(snapshot.colorProfile);
  const classes = new Set<string>();
  const named = animated.map((layer) => {
    const name = classOf(layer.node.name, classes);

    classes.add(name);

    return {
      ...layer,
      name,
    };
  });

  return {
    timeline: `${decimal(durationOf(first.motion))}s`,
    css: named
      .map(({ node, motion, name }) =>
        keyframesCss(node, motion, {
          name,
          duration: durationOf(motion),
          space,
        }),
      )
      .join("\n\n"),
    layers: named.map(({ node, motion, name }) => ({
      id: node.id,
      name: node.name,
      class: name,
      tracks: motion.tracks,
    })),
  };
}

/** The layers whose motion has tracks, in document order. */
function animatedOf(node: SnapshotNode): Animated[] {
  const motion = node.motion;
  const own =
    motion !== undefined && motion.tracks.length > 0
      ? [
          {
            node,
            motion,
          },
        ]
      : [];

  return [...own, ...(node.children ?? []).flatMap((child) => animatedOf(child))];
}

/** A layer's `@keyframes` and the rule that runs it; only comments when CSS animates none of its tracks. */
function keyframesCss(node: SnapshotNode, motion: SnapshotMotion, rule: Rule): string {
  const { channels, comments } = channelsOf(node, motion, rule.space);
  const notes = comments.map((comment) => `/* ${comment.replaceAll("*/", "* /")} */`);

  if (channels.length === 0) {
    return notes.map((note) => note.replace("/* ", `/* ${node.name}: `)).join("\n");
  }

  return [
    `@keyframes ${rule.name} {`,
    ...notes.map((note) => `  ${note}`),
    ...blocksOf(channels.flatMap((channel) => entriesOf(channel, rule.duration))),
    "}",
    `.${rule.name} { animation: ${rule.name} ${decimal(rule.duration)}s linear both; }`,
  ].join("\n");
}

/** The keyframe blocks in time order: one per percentage and easing, its properties in the order they came. */
function blocksOf(entries: readonly Entry[]): string[] {
  const byPercent = new Map<number, Map<string, Entry[]>>();

  for (const entry of entries) {
    const groups = byPercent.get(entry.percent) ?? new Map<string, Entry[]>();
    const key = entry.easing ?? "";

    groups.set(key, [...(groups.get(key) ?? []), entry]);
    byPercent.set(entry.percent, groups);
  }

  return [...byPercent]
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
}

/** A channel's keyframe lines, held at its first value from 0% and its last to 100%, as Figma holds them. */
function entriesOf(channel: Channel, duration: number): Entry[] {
  const byTime = new Map(channel.points.map((point) => [point.t, point]));
  const points = [...byTime.values()].sort((a, b) => a.t - b.t);
  const percentOf = (t: number) => (duration > 0 ? Math.min(100, Math.round((t / duration) * 10_000) / 100) : 0);
  const entries = new Map<number, Entry>();

  points.forEach((point, index) => {
    const easing = index === points.length - 1 ? "linear" : keyframeEasing(point.easing);
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
