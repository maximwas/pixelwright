import { colorCss } from "../css/color.ts";
import type { Contrast, ContrastText } from "../types/contrast.ts";
import type { Snapshot, SnapshotNode, SnapshotPaint, TextSegment } from "../types/snapshot.ts";

type Rgb = { r: number; g: number; b: number };
type Layer = { color: Rgb; alpha: number } | { kind: string };

const WHITE: Rgb = {
  r: 1,
  g: 1,
  b: 1,
};
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
  const texts: ContrastText[] = [];
  const walk = (node: SnapshotNode, ancestors: readonly SnapshotNode[]) => {
    if (!node.visible) {
      return;
    }

    if (node.type === "TEXT") {
      const rated = rate(node, ancestors);

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

function rate(node: SnapshotNode, ancestors: readonly SnapshotNode[]): ContrastText | null {
  const segments = node.text?.segments ?? [];
  const behind = backdropOf(node, ancestors);
  let worst: ContrastText | null = null;

  for (const segment of segments) {
    const paint = topSolid(segment.fills);

    if (paint === null) {
      continue;
    }

    const rated = rateSegment(node, segment, paint, behind);

    if (worst === null || (rated.ratio ?? Infinity) < (worst.ratio ?? Infinity)) {
      worst = rated;
    }
  }

  return worst;
}

function rateSegment(
  node: SnapshotNode,
  segment: TextSegment,
  paint: { color: Rgb; alpha: number },
  behind: Rgb | string,
): ContrastText {
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
      color: colorCss(paint.color, alpha),
      backdrop: behind,
      ratio: null,
      aa: null,
      aaa: null,
    };
  }

  const color = over(paint.color, alpha, behind);
  const ratio = contrastRatio(color, behind);

  return {
    ...base,
    color: colorCss(paint.color, alpha),
    backdrop: colorCss(behind, 1),
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= (large ? 3 : 4.5),
    aaa: ratio >= (large ? 4.5 : 7),
  };
}

/** The colour behind a layer, or what it is in words when it is not one colour; white when nothing opaque is behind. */
function backdropOf(node: SnapshotNode, ancestors: readonly SnapshotNode[]): Rgb | string {
  const layers: Layer[] = [];
  let current = node;

  for (let level = ancestors.length - 1; level >= 0; level--) {
    const parent = ancestors[level] as SnapshotNode;
    const siblings = parent.children ?? [];
    const index = siblings.indexOf(current);

    // Figma lists children bottom first: those before it are below it.
    for (let below = index - 1; below >= 0; below--) {
      const sibling = siblings[below] as SnapshotNode;

      if (sibling.visible && covers(sibling, node)) {
        layers.push(...paintLayers(sibling));
      }
    }

    layers.push(...paintLayers(parent));
    current = parent;
  }

  let color = WHITE;
  const opaque = layers.findIndex((layer) => "kind" in layer || layer.alpha >= 1);
  const stack = opaque === -1 ? layers : layers.slice(0, opaque + 1);

  for (const layer of stack.toReversed()) {
    if ("kind" in layer) {
      return layer.kind;
    }

    color = over(layer.color, layer.alpha, color);
  }

  return color;
}

/** A layer's visible fills, top first, each as a colour with its alpha or the kind of fill it is. */
function paintLayers(node: SnapshotNode): Layer[] {
  const fills = Array.isArray(node.fills) ? node.fills : [];
  const opacity = node.opacity ?? 1;

  return fills
    .filter((paint) => paint.visible !== false)
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

function topSolid(paints: readonly SnapshotPaint[]): { color: Rgb; alpha: number } | null {
  const visible = paints.filter((paint) => paint.visible !== false);

  return solidOf(visible.at(-1));
}

function solidOf(paint: SnapshotPaint | undefined): { color: Rgb; alpha: number } | null {
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

function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return {
    r: top.r * alpha + bottom.r * (1 - alpha),
    g: top.g * alpha + bottom.g * (1 - alpha),
    b: top.b * alpha + bottom.b * (1 - alpha),
  };
}

/** WCAG 2's contrast ratio of two colours, 1 to 21. */
function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x) as [number, number];

  return (light + 0.05) / (dark + 0.05);
}

function luminance({ r, g, b }: Rgb): number {
  const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
