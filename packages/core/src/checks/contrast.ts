import { type Channels, Color } from "../kernel/color/color.ts";
import { type ColorSpace, colorSpaceOf } from "../kernel/color/color-space.ts";
import type { Contrast, ContrastText } from "../types/contrast.ts";
import type { Snapshot, SnapshotNode, SnapshotPaint, TextSegment } from "../types/snapshot.ts";

type Layer = { color: Channels; alpha: number } | { kind: string };

/** What a fill CSS cannot reduce to one colour is, in words. */
const KINDS: Readonly<Record<string, string>> = {
  IMAGE: "an image",
  VIDEO: "a video",
  GRADIENT_LINEAR: "a gradient",
  GRADIENT_RADIAL: "a gradient",
  GRADIENT_ANGULAR: "a gradient",
  GRADIENT_DIAMOND: "a gradient",
};

/**
 * Each visible text's WCAG contrast with what is behind it: the layers below it in its parent that cover it, then its
 * ancestors' fills, see-through ones laid over what is below them. An image or a gradient behind is said, not guessed.
 */
export function contrastCheck(snapshot: Snapshot): Contrast {
  const space = colorSpaceOf(snapshot.colorProfile);
  const texts: ContrastText[] = [];
  const walk = (node: SnapshotNode, ancestors: readonly SnapshotNode[]) => {
    if (!node.visible) {
      return;
    }

    if (node.type === "TEXT") {
      const rated = rate(node, ancestors, space);

      if (rated !== null) {
        texts.push(rated);
      }

      return;
    }

    for (const child of node.children ?? []) {
      walk(child, [...ancestors, node]);
    }
  };

  walk(snapshot.root, []);

  const failing = texts.filter((text) => text.aa === false).length;
  const unknown = texts.filter((text) => text.ratio === null).length;

  return {
    summary: `${texts.length} texts: ${failing} below AA${unknown === 0 ? "" : `, ${unknown} over an image or gradient (check those by eye)`}.`,
    texts,
  };
}

function rate(node: SnapshotNode, ancestors: readonly SnapshotNode[], space: ColorSpace): ContrastText | null {
  const segments = node.text?.segments ?? [];
  const behind = backdropOf(node, ancestors, space);
  let worst: ContrastText | null = null;

  for (const segment of segments) {
    const paint = topSolid(segment.fills);
    const visible = segment.fills.filter((fill) => fill.visible ?? true);

    if (paint === null && visible.length === 0) {
      continue;
    }

    const rated =
      paint === null
        ? unknownColor(node, segment, KINDS[visible.at(-1)?.type ?? ""] ?? "a fill CSS cannot hold")
        : rateSegment(node, segment, {
            paint,
            behind,
            space,
          });

    if (worst === null || (rated.ratio ?? Infinity) < (worst.ratio ?? Infinity)) {
      worst = rated;
    }
  }

  return worst;
}

/** What a run's colour is measured against: its top paint, what is behind the text (or why it is not known), the space. */
interface Measured {
  readonly paint: { color: Channels; alpha: number };
  readonly behind: Color | string;
  readonly space: ColorSpace;
}

function rateSegment(node: SnapshotNode, segment: TextSegment, { paint, behind, space }: Measured): ContrastText {
  const size = segment.fontSize;
  const weight = segment.fontWeight;
  const large = size >= 24 || (size >= 18.66 && weight >= 700);
  const alpha = paint.alpha * (node.opacity ?? 1);
  const base = {
    id: node.id,
    name: node.name,
    text: (node.text?.characters ?? "").slice(0, 40),
    size,
    weight,
    large,
  };

  if (typeof behind === "string") {
    return {
      ...base,
      color: Color.of(paint.color, space).faded(alpha).css(),
      backdrop: behind,
      ratio: null,
      aa: null,
      aaa: null,
    };
  }

  // The text's colour laid over what is behind it; Color measures WCAG contrast on the sRGB form.
  const ratio = Color.of(
    {
      ...paint.color,
      a: alpha,
    },
    space,
  )
    .over(behind)
    .contrast(behind);

  return {
    ...base,
    color: Color.of(paint.color, space).faded(alpha).css(),
    backdrop: behind.css(),
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= (large ? 3 : 4.5),
    aaa: ratio >= (large ? 4.5 : 7),
  };
}

/**
 * The colour behind a layer, or what it is in words when it is not one colour: the layers below it in each parent
 * (their own children included) that paint under it, then the parent's fills, top first, until an opaque one.
 */
function backdropOf(node: SnapshotNode, ancestors: readonly SnapshotNode[], space: ColorSpace): Color | string {
  const layers: Layer[] = [];
  let current = node;

  for (let level = ancestors.length - 1; level >= 0; level--) {
    const parent = ancestors[level] as SnapshotNode;
    const siblings = parent.children ?? [];
    const index = siblings.indexOf(current);

    // Figma lists children bottom first: those before it are below it.
    for (let below = index - 1; below >= 0; below--) {
      const found = paintedUnder(siblings[below] as SnapshotNode, node);

      if (found.partly !== null) {
        return `partly over ${found.partly.id} "${found.partly.name}": it covers only part of the text`;
      }

      layers.push(...found.layers);
    }

    layers.push(...paintLayers(parent));
    current = parent;
  }

  const opaque = layers.findIndex((layer) => "kind" in layer || layer.alpha >= 1);

  if (opaque === -1) {
    return "nothing opaque behind it in the layer read: check it inside its screen";
  }

  let color: Color | null = null;

  for (const layer of layers.slice(0, opaque + 1).toReversed()) {
    if ("kind" in layer) {
      return layer.kind;
    }

    // Laid over in the document's own space, as Figma composites them.
    color =
      color === null
        ? Color.of(layer.color, space)
        : Color.of(
            {
              ...layer.color,
              a: layer.alpha,
            },
            space,
          ).over(color);
  }

  return color as Color;
}

/**
 * What a layer below the text paints under it, top first: its children's paints (above its own) and its own fills. A
 * painting layer that meets the text without covering it makes the backdrop two things at once. A text is never a
 * backdrop: its fills colour thin glyphs, not its box.
 */
function paintedUnder(layer: SnapshotNode, text: SnapshotNode): { layers: Layer[]; partly: SnapshotNode | null } {
  if (!layer.visible || layer.type === "TEXT" || !meets(layer, text)) {
    return {
      layers: [],
      partly: null,
    };
  }

  const layers: Layer[] = [];

  for (const child of (layer.children ?? []).toReversed()) {
    const found = paintedUnder(child, text);

    if (found.partly !== null) {
      return found;
    }

    layers.push(...found.layers);
  }

  const own = paintLayers(layer);

  if (own.length > 0 && !covers(layer, text)) {
    return {
      layers: [],
      partly: layer,
    };
  }

  return {
    layers: [...layers, ...own],
    partly: null,
  };
}

function meets(a: SnapshotNode, b: SnapshotNode): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function unknownColor(node: SnapshotNode, segment: TextSegment, kind: string): ContrastText {
  const size = segment.fontSize;
  const weight = segment.fontWeight;

  return {
    id: node.id,
    name: node.name,
    text: (node.text?.characters ?? "").slice(0, 40),
    color: kind,
    backdrop: "not compared",
    ratio: null,
    size,
    weight,
    large: size >= 24 || (size >= 18.66 && weight >= 700),
    aa: null,
    aaa: null,
  };
}

/** A layer's visible fills, top first, each as a colour with its alpha or the kind of fill it is. */
function paintLayers(node: SnapshotNode): Layer[] {
  const fills = Array.isArray(node.fills) ? node.fills : [];
  const opacity = node.opacity ?? 1;

  return fills
    .filter((paint) => paint.visible ?? true)
    .toReversed()
    .map((paint): Layer => {
      const solid = solidOf(paint);

      return solid === null
        ? { kind: KINDS[paint.type] ?? "a fill CSS cannot hold" }
        : {
            color: solid.color,
            alpha: solid.alpha * opacity,
          };
    });
}

function topSolid(paints: readonly SnapshotPaint[]): { color: Channels; alpha: number } | null {
  const visible = paints.filter((paint) => paint.visible ?? true);

  return solidOf(visible.at(-1));
}

function solidOf(paint: SnapshotPaint | undefined): { color: Channels; alpha: number } | null {
  if (paint?.type !== "SOLID" || paint.color === undefined) {
    return null;
  }

  return {
    color: paint.color,
    alpha: (paint.opacity ?? 1) * (paint.color.a ?? 1),
  };
}

function covers(outer: SnapshotNode, inner: SnapshotNode): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height
  );
}
