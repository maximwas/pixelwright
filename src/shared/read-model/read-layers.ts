import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** A layer of a walk and the layer it sits in: null for the walk's root. */
export interface WalkedLayer {
  readonly layer: ReadLayer;
  readonly parent: ReadLayer | null;
}

/**
 * The read model's layer tree as its readers go through it: depth first in document order (the XML's and the hints'),
 * and a layer's shown children (a hidden one is a stub, D-18).
 */
export class ReadLayers {
  /** The root and the layers under it, each with its parent; a layer `enters` refuses is left out with its insides. */
  *walk(root: ReadLayer, enters: (layer: ReadLayer) => boolean = () => true): Generator<WalkedLayer> {
    const stack: WalkedLayer[] = [{ layer: root, parent: null }];

    for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
      const { layer } = next;

      if (enters(layer)) {
        yield next;

        // A loop, not push(...children): a frame with tens of thousands of children would pass the argument limit.
        for (const child of [...(layer.children ?? [])].reverse()) {
          stack.push({ layer: child, parent: layer });
        }
      }
    }
  }

  visibleChildren(layer: ReadLayer): ReadLayer[] {
    return (layer.children ?? []).filter((child) => child.visible);
  }
}
