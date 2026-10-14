import type { InspectBox } from "../types/inspect.ts";
import type { MeasuredLayer, MeasuredPair } from "../types/measure.ts";

/** How far two edges may differ and still be aligned: Figma keeps fractions of a pixel. */
const ALIGNED = 0.01;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Each layer against the one before it in the list: the gap between their boxes on each axis, how their edges and
 * centres line up, and, when one holds the other, how far it sits from each edge. Layout boxes, or painted ones.
 */
export function measureLayers(layers: readonly MeasuredLayer[], painted: boolean): { pairs: MeasuredPair[] } {
  return {
    pairs: layers.slice(1).map((layer, index) => pairOf(layers[index] as MeasuredLayer, layer, painted)),
  };
}

function pairOf(first: MeasuredLayer, second: MeasuredLayer, painted: boolean): MeasuredPair {
  const a = sides(painted ? (first.paintedBox ?? first.box) : first.box);
  const b = sides(painted ? (second.paintedBox ?? second.box) : second.box);
  const gapX = Math.max(b.left - a.right, a.left - b.right);
  const gapY = Math.max(b.top - a.bottom, a.top - b.bottom);
  const edges = edgesOf(a, b);
  const { contains, inset } = containmentOf(a, b);
  const refA = {
    id: first.id,
    name: first.name,
  };
  const refB = {
    id: second.id,
    name: second.name,
  };

  return {
    a: refA,
    b: refB,
    summary: summaryOf(refA, refB, {
      gapX: round(gapX),
      gapY: round(gapY),
      right: b.left >= a.right,
      below: b.top >= a.bottom,
      edges,
      contains,
      inset,
    }),
    gap: {
      x: round(gapX),
      y: round(gapY),
    },
    edges,
    ...(contains === null || inset === null
      ? {}
      : {
          contains,
          inset,
        }),
  };
}

type Sides = ReturnType<typeof sides>;

/** How far each of b's edges, and its centre, lies from a's. */
function edgesOf(a: Sides, b: Sides): MeasuredPair["edges"] {
  return {
    left: round(b.left - a.left),
    right: round(b.right - a.right),
    top: round(b.top - a.top),
    bottom: round(b.bottom - a.bottom),
    centerX: round((b.left + b.right - a.left - a.right) / 2),
    centerY: round((b.top + b.bottom - a.top - a.bottom) / 2),
  };
}

/** Which box holds the other ("a" or "b"), and how far in the inner one sits; null for neither. */
function containmentOf(
  a: Sides,
  b: Sides,
): { contains: "a" | "b" | null; inset: { top: number; right: number; bottom: number; left: number } | null } {
  const contains = within(b, a) ? "a" : within(a, b) ? "b" : null;
  const [outer, inner] = contains === "b" ? [b, a] : [a, b];

  return {
    contains,
    inset:
      contains === null
        ? null
        : {
            top: round(inner.top - outer.top),
            right: round(outer.right - inner.right),
            bottom: round(outer.bottom - inner.bottom),
            left: round(inner.left - outer.left),
          },
  };
}

interface Relation {
  readonly gapX: number;
  readonly gapY: number;
  readonly right: boolean;
  readonly below: boolean;
  readonly edges: MeasuredPair["edges"];
  readonly contains: "a" | "b" | null;
  readonly inset: NonNullable<MeasuredPair["inset"]> | null;
}

function summaryOf(a: MeasuredPair["a"], b: MeasuredPair["b"], relation: Relation): string {
  const named = (layer: MeasuredPair["a"]) => `${layer.id} "${layer.name}"`;
  const { gapX, gapY, inset, contains } = relation;

  if (contains !== null && inset !== null) {
    const [outer, inner] = contains === "a" ? [a, b] : [b, a];

    return `${named(inner)} is inside ${named(outer)}: ${inset.top} px from its top, ${inset.right} from its right, ${inset.bottom} from its bottom, ${inset.left} from its left.`;
  }

  const apart = [
    ...(gapX >= 0 ? [`${gapX} px ${relation.right ? "right" : "left"} of`] : []),
    ...(gapY >= 0 ? [`${gapY} px ${relation.below ? "below" : "above"}`] : []),
  ];
  const where =
    apart.length === 0 ? `overlaps ${named(a)} by ${-gapX}×${-gapY} px` : `is ${apart.join(" and ")} ${named(a)}`;
  const aligned = alignedEdges(relation.edges);

  return `${named(b)} ${where}${aligned === "" ? "" : `; ${aligned} aligned`}.`;
}

function alignedEdges(edges: MeasuredPair["edges"]): string {
  const names = (
    [
      ["left", "lefts"],
      ["right", "rights"],
      ["top", "tops"],
      ["bottom", "bottoms"],
      ["centerX", "centres (x)"],
      ["centerY", "centres (y)"],
    ] as const
  )
    .filter(([key]) => Math.abs(edges[key]) <= ALIGNED)
    .map(([, name]) => name);

  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function sides(box: InspectBox) {
  return {
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
  };
}

function within(inner: ReturnType<typeof sides>, outer: ReturnType<typeof sides>): boolean {
  return (
    inner.left >= outer.left - ALIGNED &&
    inner.top >= outer.top - ALIGNED &&
    inner.right <= outer.right + ALIGNED &&
    inner.bottom <= outer.bottom + ALIGNED
  );
}
