import type { ApplyChange } from "@pixelwright/core";
import { indexIn, insideInstance, loadPageOf } from "../../figma/nodes.ts";
import { WriteError } from "../../figma/write-error.ts";

/** Where a layer goes: a parent and the index among its children. */
export interface Place {
  readonly parent: PageNode | SceneNode;
  readonly index: number;
}

/**
 * Where the call's new and moved layers go: next to the layer before or after names, else into their parent element,
 * the call's parent or the page, after the element before them in the XML.
 */
export class Placement {
  readonly #changes: readonly ApplyChange[];
  readonly #layers: ReadonlyMap<string, SceneNode | null>;
  readonly #top: PageNode | SceneNode | null;

  constructor(
    changes: readonly ApplyChange[],
    layers: ReadonlyMap<string, SceneNode | null>,
    top: PageNode | SceneNode | null,
  ) {
    this.#changes = changes;
    this.#layers = layers;
    this.#top = top;
  }

  async whereTo(change: ApplyChange): Promise<Place> {
    const parent = this.#parentOf(change);
    const neighbour = change.before ?? change.after;

    if (neighbour !== undefined) {
      return await nextTo(change, neighbour, parent);
    }

    const into = parent ?? this.#top ?? figma.currentPage;

    return {
      parent: into,
      index: await this.#indexAmong(change, into),
    };
  }

  /** An existing layer placed again as a create would be: into another parent, next to a layer, in another order. */
  async move(node: SceneNode, change: ApplyChange): Promise<void> {
    if (insideInstance(node)) {
      throw new WriteError("A layer inside an instance comes from its component and stays where it is.");
    }

    const { parent, index } = await this.whereTo(change);

    if (parent.type === "TEXT" || !("insertChild" in parent) || typeof parent.insertChild !== "function") {
      throw new WriteError(`A ${parent.type.toLowerCase()} holds no layers.`);
    }

    if (parent.type !== "SLOT" && (parent.type === "INSTANCE" || insideInstance(parent))) {
      throw new WriteError("Layers go into an instance only through its slots.");
    }

    for (let up: BaseNode | null = parent; up !== null; up = up.parent) {
      if (up.id === node.id) {
        throw new WriteError("A layer cannot go inside itself.");
      }
    }

    // Figma reads the index in the list as it is, the layer itself still in its place (checked live): the index of the
    // layer it goes before is the one to give, whichever way it moves.
    parent.insertChild(index, node);
  }

  #parentOf(change: ApplyChange): SceneNode | null {
    if (change.parent === null) {
      return null;
    }

    const parent = this.#layers.get(change.parent) ?? null;

    if (parent === null) {
      throw new WriteError("Its parent element was not written: fix the parent's error first.");
    }

    return parent;
  }

  /** After the element before it in the XML, else before the existing layer after it, else last. */
  async #indexAmong(change: ApplyChange, parent: PageNode | SceneNode): Promise<number> {
    const siblings = this.#changes.filter((other) => other.parent === change.parent);
    const at = siblings.indexOf(change);

    // The plugin's sandbox may lack ES2023's toReversed: a copy reversed in place.
    for (const before of siblings.slice(0, at).reverse()) {
      const node = this.#layers.get(before.ref);

      if (node !== undefined && node !== null && node.parent?.id === parent.id) {
        return indexIn(parent, node) + 1;
      }
    }

    for (const after of siblings.slice(at + 1)) {
      const node = after.kind === "update" && after.id !== null ? await figma.getNodeByIdAsync(after.id) : null;

      if (node !== null && node.parent?.id === parent.id) {
        return indexIn(parent, node);
      }
    }

    return "children" in parent ? parent.children.length : 0;
  }
}

/** Next to the layer before or after names, which must sit in the element's parent. */
async function nextTo(change: ApplyChange, neighbour: string, parent: SceneNode | null): Promise<Place> {
  const sibling = await figma.getNodeByIdAsync(neighbour);

  if (sibling === null || sibling.parent === null) {
    throw new WriteError(`No layer ${neighbour} to put the new one next to.`);
  }

  if (parent !== null && sibling.parent.id !== parent.id) {
    throw new WriteError(`${neighbour} is not in this element's parent: before and after name a layer beside it.`);
  }

  await loadPageOf(sibling);

  const at = indexIn(sibling.parent, sibling);

  return {
    parent: sibling.parent as PageNode | SceneNode,
    index: change.before === undefined ? at + 1 : at,
  };
}
