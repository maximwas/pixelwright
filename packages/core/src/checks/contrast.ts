import { Color } from "../kernel/color/color.ts";
import { type ColorSpace, colorSpaceOf } from "../kernel/color/color-space.ts";
import type { Contrast, ContrastText } from "../types/contrast.ts";
import type { Snapshot, SnapshotNode, TextSegment } from "../types/snapshot.ts";
import { type Backdrop, backdropOf, meets, type Unknown } from "./contrast/backdrop.ts";
import { kindOf, topSolid } from "./contrast/paints.ts";

/** A text rated: its row, and why its contrast is not one number when it is not. */
interface Rated {
  readonly row: ContrastText;
  readonly unknown: Unknown | null;
}

/** How the summary counts each reason a contrast is not one number, in this order. */
const UNKNOWN_COUNTS: readonly (readonly [Unknown, string])[] = [
  ["image", "over an image or gradient (check those by eye)"],
  ["partly", "partly over another layer (check those by eye)"],
  ["nothing", "with nothing opaque behind it in the read (check those inside their screen)"],
];

/**
 * Each visible text's WCAG contrast with what is behind it: the layers below it in its parent that cover it, then its
 * ancestors' fills, see-through ones laid over what is below them. An image or a gradient behind is said, not guessed.
 * A text a clipping frame cuts out of view is left out, and counted.
 */
export function contrastCheck(snapshot: Snapshot): Contrast {
  const space = colorSpaceOf(snapshot.colorProfile);
  const rated: Rated[] = [];
  let cut = 0;
  const walk = (node: SnapshotNode, ancestors: readonly SnapshotNode[]) => {
    if (!node.visible) {
      return;
    }

    if (node.type === "TEXT" && cutOff(node, ancestors)) {
      cut++;

      return;
    }

    if (node.type === "TEXT") {
      const text = rate(node, ancestors, space);

      if (text !== null) {
        rated.push(text);
      }

      return;
    }

    for (const child of node.children ?? []) {
      walk(child, [...ancestors, node]);
    }
  };

  walk(snapshot.root, []);

  return {
    summary: summaryOf(rated, cut),
    texts: rated.map(({ row }) => row),
  };
}

function summaryOf(rated: readonly Rated[], cut: number): string {
  const failing = rated.filter(({ row }) => row.aa === false).length;
  const unknown = UNKNOWN_COUNTS.map(([reason, says]) => {
    const count = rated.filter((text) => text.unknown === reason).length;

    return count === 0 ? "" : `, ${count} ${says}`;
  }).join("");
  const left =
    cut === 0 ? "" : ` ${cut === 1 ? "1 text is" : `${cut} texts are`} left out: cut off by a clipping frame.`;

  return `${rated.length} texts: ${failing} below AA${unknown}.${left}`;
}

/** Whether a frame above that clips its content leaves none of the text in view. */
function cutOff(node: SnapshotNode, ancestors: readonly SnapshotNode[]): boolean {
  return ancestors.some((ancestor) => ancestor.clipsContent && !meets(ancestor, node));
}

/** A text's worst run against what is behind it; null when no run has a visible paint. */
function rate(node: SnapshotNode, ancestors: readonly SnapshotNode[], space: ColorSpace): Rated | null {
  const behind = backdropOf(node, ancestors, space);
  let worst: Rated | null = null;

  for (const segment of node.text?.segments ?? []) {
    const rated = rateSegment(node, segment, {
      behind,
      space,
    });

    if (rated !== null && (worst === null || (rated.row.ratio ?? Infinity) < (worst.row.ratio ?? Infinity))) {
      worst = rated;
    }
  }

  return worst;
}

/** What a run's colour is measured against: what is behind the text (or why it is not known), and the space. */
interface Measured {
  readonly behind: Backdrop;
  readonly space: ColorSpace;
}

function rateSegment(node: SnapshotNode, segment: TextSegment, { behind, space }: Measured): Rated | null {
  const paint = topSolid(segment.fills);
  const visible = segment.fills.filter((fill) => fill.visible ?? true);
  const base = baseOf(node, segment);

  if (paint === null) {
    return visible.length === 0 ? null : unrated(base, [kindOf(visible.at(-1)?.type), "not compared"], "image");
  }

  const color = Color.of(
    {
      ...paint.color,
      a: paint.alpha * (node.opacity ?? 1),
    },
    space,
  );

  if (!(behind instanceof Color)) {
    return unrated(base, [color.css(), behind.says], behind.unknown);
  }

  // The text's colour laid over what is behind it; Color measures WCAG contrast on the sRGB form.
  const ratio = color.over(behind).contrast(behind);

  return {
    row: {
      ...base,
      color: color.css(),
      backdrop: behind.css(),
      ratio: Math.round(ratio * 100) / 100,
      aa: ratio >= (base.large ? 3 : 4.5),
      aaa: ratio >= (base.large ? 4.5 : 7),
    },
    unknown: null,
  };
}

/** A row without a ratio: the text's colour and what is behind it, each in words when it is not one colour. */
function unrated(base: Base, [color, backdrop]: readonly [string, string], unknown: Unknown): Rated {
  return {
    row: {
      ...base,
      color,
      backdrop,
      ratio: null,
      aa: null,
      aaa: null,
    },
    unknown,
  };
}

/** What a row says of the text and its run whatever the colours: which text, its size, and whether it is large. */
type Base = Pick<ContrastText, "id" | "name" | "text" | "size" | "weight" | "large">;

function baseOf(node: SnapshotNode, segment: TextSegment): Base {
  const size = segment.fontSize;
  const weight = segment.fontWeight;

  return {
    id: node.id,
    name: node.name,
    text: (node.text?.characters ?? "").slice(0, 40),
    size,
    weight,
    large: size >= 24 || (size >= 18.66 && weight >= 700),
  };
}
