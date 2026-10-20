import type { ApplyElement, LayerEntry } from "../types.ts";
import type { CurrentLayers } from "./current-layers.ts";
import { refsOf } from "./reads.ts";

/**
 * Elements that move their layer, by ref: placed with before or after, under another parent element (a new one
 * included), or out of the order of the layers listed with it. Every element counts as a parent, a refused one too.
 */
export function movedRefs(elements: readonly ApplyElement[], layers: CurrentLayers): Set<string> {
  const byRef = refsOf(elements);
  const order = new SiblingOrder(layers);

  return new Set(
    elements.flatMap((element) => {
      const entry = element.id === null ? undefined : layers.entry(element.id);
      const inside = element.parent === null ? undefined : byRef.get(element.parent);

      return entry !== undefined && moves(element, entry, inside, order) ? [element.ref] : [];
    }),
  );
}

/**
 * Whether an element places its layer again. A top-level one moves only by before or after, and a page's own layer in
 * a <Page> element only onto another page.
 */
function moves(element: ApplyElement, entry: LayerEntry, inside: ApplyElement | undefined, order: SiblingOrder) {
  const parent = entry.parent?.id ?? entry.page ?? null;

  if (element.attributes.before !== undefined || element.attributes.after !== undefined) {
    return true;
  }

  if (inside === undefined) {
    return false;
  }

  return inside.id !== parent || (parent !== null && order.isBack(parent, entry.node.id));
}

/** The layers listed under each parent so far: one listed after a layer it stands before in Figma moves. */
class SiblingOrder {
  readonly #layers: CurrentLayers;
  /** The furthest place in its parent of a layer listed so far, by parent. */
  readonly #furthest = new Map<string, number>();

  constructor(layers: CurrentLayers) {
    this.#layers = layers;
  }

  /** Whether this layer stands before one listed earlier under the same parent; it is counted in either way. */
  isBack(parent: string, id: string): boolean {
    const at = (this.#layers.entry(parent)?.node.children ?? []).findIndex((child) => child.id === id);
    const furthest = this.#furthest.get(parent) ?? -1;

    this.#furthest.set(parent, Math.max(furthest, at));

    return at !== -1 && at < furthest;
  }
}
