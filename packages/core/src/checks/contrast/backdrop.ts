import { Color } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { type Layer, paintLayers } from "./paints.ts";

/** Why a text's contrast is not one number: an image or gradient, a layer under part of it, nothing opaque read. */
export type Unknown = "image" | "partly" | "nothing";

/** What is behind a text: one colour, or why it is not one, in words. */
export type Backdrop = Color | { readonly unknown: Unknown; readonly says: string };

/** One step down from a text: a paint under it, or a layer that paints under only part of it. */
type Step = { readonly paint: Layer } | { readonly partly: SnapshotNode };

/**
 * The colour behind a layer, or why it is not one colour: what is under it, top first, until an opaque paint. A layer
 * covering only part of the text matters only above that paint: the paint hides what is below.
 */
export function backdropOf(node: SnapshotNode, ancestors: readonly SnapshotNode[], space: ColorSpace): Backdrop {
  const layers: Layer[] = [];

  for (const step of stepsUnder(node, ancestors)) {
    if ("partly" in step) {
      return {
        unknown: "partly",
        says: `partly over ${step.partly.id} "${step.partly.name}": it covers only part of the text`,
      };
    }

    layers.push(step.paint);

    if ("kind" in step.paint || step.paint.alpha >= 1) {
      return composited(layers, space);
    }
  }

  return {
    unknown: "nothing",
    says: "nothing opaque behind it in the layer read: check it inside its screen",
  };
}

/** Whether two layers' boxes overlap. */
export function meets(a: SnapshotNode, b: SnapshotNode): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
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

/** Paints laid over each other, bottom up from the opaque one last in the list: one colour, or what the bottom is. */
function composited(layers: readonly Layer[], space: ColorSpace): Backdrop {
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
  if (!layer.visible || layer.type === "TEXT" || !meets(layer, text)) {
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
