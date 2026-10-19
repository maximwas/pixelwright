import { Color } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { overlaps } from "../../kernel/geometry.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { type Layer, paintLayers } from "./paints.ts";

/** Why a text's contrast is not one number: an image or gradient, a layer under part of it, nothing opaque read. */
export type Unknown = "image" | "partly" | "nothing";

/** Why a text's contrast is not one number, in words. */
type NotOne = { readonly unknown: Unknown; readonly says: string };

/** What is behind a text: the colours it lies over (one, or each part's under a see-through panel), or why not known. */
export type Backdrop = { readonly colors: readonly Color[] } | NotOne;

/** One step down from a text: a paint under it, or a layer that paints under only part of it. */
type Step = { readonly paint: Layer } | { readonly partly: SnapshotNode };

/**
 * The colour behind a layer, or why it is not one colour: what is under it, top first, until an opaque paint. A layer
 * covering only part of the text matters only above that paint: the paint hides what is below. Under a see-through
 * panel (glass, matte; its blur is not weighed) the text is over each part: the backdrop without the layers under part
 * of it, and with each of them. Shortcut: such layers are not combined with each other, so where two overlap under
 * the text that part is missed; combine them when a design needs it.
 */
export function backdropOf(node: SnapshotNode, ancestors: readonly SnapshotNode[], space: ColorSpace): Backdrop {
  const steps = stepsUnder(node, ancestors);
  const end = steps.findIndex((step) => "paint" in step && opaque(step.paint));
  const above = end === -1 ? steps : steps.slice(0, end);
  const first = above.findIndex((step) => "partly" in step);
  const parts = above.slice(first).flatMap((step) => ("partly" in step ? [step.partly] : []));
  const [part] = parts;

  if (first === -1 || part === undefined) {
    return colorsOf([paintsWith(steps, null)], space);
  }

  // Every paint above the first opaque one is see-through: one that shows at all makes the panel.
  const panel = above.slice(0, first).some((step) => "paint" in step && "alpha" in step.paint && step.paint.alpha > 0);

  return panel
    ? colorsOf([paintsWith(steps, null), ...parts.map((one) => paintsWith(steps, one))], space)
    : {
        unknown: "partly",
        says: `partly over ${part.id} "${part.name}": it covers only part of the text`,
      };
}

/** The steps' paints, top first: those of one layer under part of the text included, the other such layers left out. */
function paintsWith(steps: readonly Step[], part: SnapshotNode | null): Layer[] {
  return steps.flatMap((step) => {
    if ("paint" in step) {
      return [step.paint];
    }

    return step.partly === part ? paintLayers(part) : [];
  });
}

/** The colour each list of paints (top first) makes down to its first opaque one; why not, when one makes none. */
function colorsOf(lists: readonly (readonly Layer[])[], space: ColorSpace): Backdrop {
  const colors: Color[] = [];

  for (const layers of lists) {
    const end = layers.findIndex(opaque);
    const found: Color | NotOne =
      end === -1
        ? {
            unknown: "nothing",
            says: "nothing opaque behind it in the layer read: check it inside its screen",
          }
        : composited(layers.slice(0, end + 1), space);

    if (!(found instanceof Color)) {
      return found;
    }

    if (!colors.some((color) => color.equals(found, 0))) {
      colors.push(found);
    }
  }

  return { colors };
}

/** A paint nothing below shows through: a solid at full alpha, or an image or a gradient. */
function opaque(paint: Layer): boolean {
  return "kind" in paint || paint.alpha >= 1;
}

/** A see-through layer over a text, and the colour it lays over the text and its backdrop alike. */
export interface Veil {
  readonly layer: SnapshotNode;
  readonly color: Color;
}

/** What lies over a text: see-through layers (bottom first), an opaque layer that hides it, or one not one colour. */
export type Over =
  | { readonly veils: readonly Veil[] }
  | { readonly hidden: SnapshotNode }
  | { readonly unknown: "image"; readonly says: string };

/**
 * What lies over a text and covers it whole: the layers above it in each parent, their children included. An opaque
 * paint hides the text; a see-through one (a modal's scrim) is seen through. Layers over only part of it are not
 * weighed: shortcut, the text is rated as if they were not there; rate the part under them when a design needs it.
 */
export function overOf(node: SnapshotNode, ancestors: readonly SnapshotNode[], space: ColorSpace): Over {
  const veils: Veil[] = [];
  let unknown: Over | null = null;

  for (const { layer, paint } of paintsOver(node, ancestors)) {
    if ("kind" in paint) {
      unknown ??= {
        unknown: "image",
        says: `under ${paint.kind} ${layer.id} "${layer.name}"`,
      };
    } else if (paint.alpha >= 1) {
      return { hidden: layer };
    } else if (paint.alpha > 0) {
      veils.push({
        layer,
        color: Color.of(
          {
            ...paint.color,
            a: paint.alpha,
          },
          space,
        ),
      });
    }
  }

  return unknown ?? { veils };
}

/** A colour as seen through the see-through layers over it, bottom first. */
export function throughVeils(color: Color, veils: readonly Veil[]): Color {
  return veils.reduce((seen, veil) => veil.color.over(seen), color);
}

/** What is under a text, top first: the layers below it in each parent (their own children included), then its fills. */
function stepsUnder(node: SnapshotNode, ancestors: readonly SnapshotNode[]): Step[] {
  const steps: Step[] = [];
  let current = node;

  for (let level = ancestors.length - 1; level >= 0; level--) {
    const parent = ancestors[level] as SnapshotNode;
    const siblings = parent.children ?? [];

    // Figma lists children bottom first: those before it are below it.
    for (let below = siblings.indexOf(current) - 1; below >= 0; below--) {
      steps.push(...paintedUnder(siblings[below] as SnapshotNode, node));
    }

    steps.push(...paintLayers(parent).map((paint) => ({ paint })));
    current = parent;
  }

  return steps;
}

/** A paint over a text, and the layer it is on. */
interface Cover {
  readonly layer: SnapshotNode;
  readonly paint: Layer;
}

/** The paints over a text that cover it whole, bottom first: the layers above it in each parent, then further out. */
function paintsOver(node: SnapshotNode, ancestors: readonly SnapshotNode[]): Cover[] {
  const found: Cover[] = [];
  let current = node;

  for (let level = ancestors.length - 1; level >= 0; level--) {
    const parent = ancestors[level] as SnapshotNode;
    const siblings = parent.children ?? [];

    for (const above of siblings.slice(siblings.indexOf(current) + 1)) {
      found.push(...paintedOver(above, node));
    }

    current = parent;
  }

  return found;
}

/** What a layer above a text lays over all of it, bottom first: its own fills, then its children's. */
function paintedOver(layer: SnapshotNode, text: SnapshotNode): Cover[] {
  if (!layer.visible || layer.type === "TEXT" || !overlaps(layer, text)) {
    return [];
  }

  const own = covers(layer, text) ? paintLayers(layer).toReversed() : [];

  return [
    ...own.map((paint) => ({
      layer,
      paint,
    })),
    ...(layer.children ?? []).flatMap((child) => paintedOver(child, text)),
  ];
}

/** Paints laid over each other, bottom up from the opaque one last in the list: one colour, or what the bottom is. */
function composited(layers: readonly Layer[], space: ColorSpace): Color | NotOne {
  let color: Color | null = null;

  for (const layer of layers.toReversed()) {
    if ("kind" in layer) {
      return {
        unknown: "image",
        says: layer.kind,
      };
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
function paintedUnder(layer: SnapshotNode, text: SnapshotNode): Step[] {
  if (!layer.visible || layer.type === "TEXT" || !overlaps(layer, text)) {
    return [];
  }

  const children = (layer.children ?? []).toReversed().flatMap((child) => paintedUnder(child, text));
  const own = paintLayers(layer);

  return own.length > 0 && !covers(layer, text)
    ? [...children, { partly: layer }]
    : [...children, ...own.map((paint) => ({ paint }))];
}

function covers(outer: SnapshotNode, inner: SnapshotNode): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height
  );
}
