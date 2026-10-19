import { Color } from "../kernel/color/color.ts";
import { type ColorSpace, colorSpaceOf } from "../kernel/color/color-space.ts";
import type { Contrast, ContrastText } from "../types/contrast.ts";
import type { Snapshot, SnapshotNode, TextSegment } from "../types/snapshot.ts";
import {
  type Backdrop,
  backdropOf,
  meets,
  type Over,
  overOf,
  throughVeils,
  type Unknown,
  type Veil,
} from "./contrast/backdrop.ts";
import { kindOf, topSolid } from "./contrast/paints.ts";

/** A run rated: its row, why its contrast is not one number when it is not, and whether it is seen through a veil. */
interface Rated {
  readonly row: ContrastText;
  readonly unknown: Unknown | null;
  readonly veiled: boolean;
}

/** Why a text is left out: nobody sees it. */
type LeftOut = "cut" | "hidden";

/** How the summary counts each reason a contrast is not one number, in this order. */
const UNKNOWN_COUNTS: readonly (readonly [Unknown, string])[] = [
  ["image", "over an image or gradient (check those by eye)"],
  ["partly", "partly over another layer (check those by eye)"],
  ["nothing", "with nothing opaque behind it in the read (check those inside their screen)"],
];

/** Texts under a scrim are rated as seen and counted: whether such inactive content is exempt is the designer's call. */
const VEILED = "under a see-through layer (a scrim: content behind a modal may be exempt)";

const LEFT_OUT_COUNTS: readonly (readonly [LeftOut, string])[] = [
  ["cut", "cut off by a clipping frame"],
  ["hidden", "hidden under an opaque layer"],
];

/**
 * Each visible text's WCAG contrast with what is behind it: the layers below it in its parent that cover it, then its
 * ancestors' fills, see-through ones laid over what is below them, and the see-through layers over it (a scrim) laid
 * over both. An image or a gradient is said, not guessed. A text nobody sees (cut off by a clipping frame, under an
 * opaque layer) is left out, and counted.
 */
export function contrastCheck(snapshot: Snapshot): Contrast {
  const space = colorSpaceOf(snapshot.colorProfile);
  const rated: Rated[][] = [];
  const left: LeftOut[] = [];
  const walk = (node: SnapshotNode, ancestors: readonly SnapshotNode[]) => {
    if (!node.visible) {
      return;
    }

    if (node.type === "TEXT") {
      const text = rateText(node, ancestors, space);

      if (typeof text === "string") {
        left.push(text);
      } else if (text.length > 0) {
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
    summary: summaryOf(rated, left),
    texts: rated.flat().map(({ row }) => row),
  };
}

/** The counts, of texts (each with its runs): below AA, why a contrast is not one number, seen through a veil, left out. */
function summaryOf(rated: readonly (readonly Rated[])[], left: readonly LeftOut[]): string {
  const failing = rated.filter((runs) => runs.some(({ row }) => row.aa === false)).length;
  const reasons = rated.map((runs) => runs.find(({ unknown }) => unknown !== null)?.unknown);
  const unclear = counted([
    ...UNKNOWN_COUNTS.map(([reason, says]) => [reasons.filter((one) => one === reason).length, says] as const),
    [rated.filter((runs) => runs.some(({ veiled }) => veiled)).length, VEILED],
  ]);
  const out = counted(
    LEFT_OUT_COUNTS.map(([reason, says]) => [left.filter((one) => one === reason).length, says] as const),
  );

  return `${rated.length} texts: ${failing} below AA${unclear.map((part) => `, ${part}`).join("")}.${out.length === 0 ? "" : ` Left out as not visible: ${out.join(", ")}.`}`;
}

/** Each count that is not zero, with what it counts. */
function counted(counts: readonly (readonly [number, string])[]): string[] {
  return counts.flatMap(([count, says]) => (count === 0 ? [] : [`${count} ${says}`]));
}

/**
 * A text's runs against what is behind and over it, one row per colour (a link in a sentence is its own row), or why
 * it is left out. No rows when no run has a visible paint.
 */
function rateText(node: SnapshotNode, ancestors: readonly SnapshotNode[], space: ColorSpace): Rated[] | LeftOut {
  if (ancestors.some((ancestor) => ancestor.clipsContent && !meets(ancestor, node))) {
    return "cut";
  }

  const over = overOf(node, ancestors, space);

  if ("hidden" in over) {
    return "hidden";
  }

  const measured = {
    behind: backdropOf(node, ancestors, space),
    over,
    space,
  };
  const runs = new Map<string, Rated>();

  for (const segment of node.text?.segments ?? []) {
    const run = rateSegment(node, segment, measured);
    const key = `${run?.row.color} ${run?.row.large}`;

    if (run !== null && !runs.has(key)) {
      runs.set(key, run);
    }
  }

  const rows = [...runs.values()];
  const whole = (node.text?.characters ?? "").slice(0, 40);

  // A text of one colour is named by its own characters, not its first run's.
  return rows.length === 1
    ? rows.map((run) => ({
        ...run,
        row: {
          ...run.row,
          text: whole,
        },
      }))
    : rows;
}

/** What a run's colour is measured against: what is behind the text and over it (or why it is not known), the space. */
interface Measured {
  readonly behind: Backdrop;
  readonly over: Exclude<Over, { hidden: SnapshotNode }>;
  readonly space: ColorSpace;
}

function rateSegment(node: SnapshotNode, segment: TextSegment, { behind, over, space }: Measured): Rated | null {
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

  if ("unknown" in over) {
    return unrated(base, [color.css(), over.says], over.unknown);
  }

  return "colors" in behind
    ? ratedOver(base, color, [behind.colors, over.veils])
    : unrated(base, [color.css(), behind.says], behind.unknown);
}

/**
 * A run's ratio: its colour over what is behind it, both seen through the veils over the text (bottom first); over
 * several backdrops (the parts under a see-through panel), the worst of them.
 */
function ratedOver(base: Base, color: Color, [colors, veils]: readonly [readonly Color[], readonly Veil[]]): Rated {
  // Color measures WCAG contrast on the sRGB form.
  const { behind, ratio } = colors
    .map((one) => ({
      behind: one,
      ratio: throughVeils(color.over(one), veils).contrast(throughVeils(one, veils)),
    }))
    .reduce((worst, next) => (next.ratio < worst.ratio ? next : worst));
  const top = veils.at(-1);
  const parts = colors.length > 1 ? ` (the worst of ${colors.length} backdrops under a see-through layer)` : "";

  return {
    row: {
      ...base,
      color: color.css(),
      backdrop: `${behind.css()}${parts}${top === undefined ? "" : ` under ${top.layer.id} "${top.layer.name}" ${top.color.css()}`}`,
      ratio: Math.round(ratio * 100) / 100,
      aa: ratio >= (base.large ? 3 : 4.5),
      aaa: ratio >= (base.large ? 4.5 : 7),
    },
    unknown: null,
    veiled: top !== undefined,
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
    veiled: false,
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
    text: segment.characters.slice(0, 40),
    size,
    weight,
    large: size >= 24 || (size >= 18.66 && weight >= 700),
  };
}
