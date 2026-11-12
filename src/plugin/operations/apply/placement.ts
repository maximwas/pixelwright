import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_TEXT } from "@/plugin/operations/apply/apply.constants.ts";
import type { ApplyCall, Holder, Place } from "@/plugin/operations/apply/apply.types.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

/**
 * Where the call's new and moved layers go (T-124): next to the layer before or after names, else into their parent
 * element, the call's parent or the page, after the element before them in the XML.
 */
@injectable()
export class Placement {
  readonly #lookup;
  readonly #pages;

  constructor(lookup = inject(NODE_LOOKUP), pages = inject(PAGE_LOADER)) {
    this.#lookup = lookup;
    this.#pages = pages;
  }

  async whereTo(change: ApplyChangeData, call: ApplyCall): Promise<Place> {
    const parent = this.#parentOf(change, call);
    const neighbour = change.before ?? change.after;

    if (neighbour !== undefined) {
      // Inside a copy the source's id names the copy's layer, as the element's own id does.
      const copied = change.copy === undefined ? undefined : call.counterparts.inCopy(change.copy, neighbour);

      return await this.#nextTo(change, copied ?? (await this.#lookup.node(neighbour)), parent);
    }

    const into = (parent ?? call.top) as Holder;

    return { parent: into, index: await this.#indexAmong(change, into, call) };
  }

  /** An existing layer placed again as a create would be: into another parent, next to a layer, in another order. */
  async move(
    node: SceneNode,
    change: ApplyChangeData,
    call: ApplyCall,
  ): Promise<void> {
    if (this.#instanced(node.parent)) {
      throw new WriteError(APPLY_TEXT.inInstance);
    }

    if (call.dry) {
      return;
    }

    const { parent, index } = await this.whereTo(change, call);

    if (!("insertChild" in parent) || parent.type === FIGMA_NODE_TYPE.text) {
      throw new WriteError(APPLY_TEXT.holdsNoLayers(parent.type.toLowerCase()));
    }

    if (parent.type !== FIGMA_NODE_TYPE.slot && this.#instanced(parent)) {
      throw new WriteError(APPLY_TEXT.onlySlots);
    }

    for (let up: BaseNode | null = parent; up !== null; up = up.parent) {
      if (up.id === node.id) {
        throw new WriteError(APPLY_TEXT.intoItself);
      }
    }

    // FX-061: Figma reads the index in the list as it is, the layer itself still in its place: the index of the layer
    // it goes before is the one to give, whichever way it moves.
    parent.insertChild(index, node);
  }

  /** Whether the layer sits in an instance and not in a slot of it: there its children come from the component. */
  #instanced(node: BaseNode | null): boolean {
    for (let up = node; up !== null; up = up.parent) {
      if (up.type === FIGMA_NODE_TYPE.slot) {
        return false;
      }

      if (up.type === FIGMA_NODE_TYPE.instance) {
        return true;
      }
    }

    return false;
  }

  #parentOf(change: ApplyChangeData, call: ApplyCall): BaseNode | null {
    if (change.parent === null) {
      return null;
    }

    const parent = call.layers.get(change.parent) as BaseNode | undefined;

    if (parent === undefined) {
      throw new WriteError(APPLY_TEXT.noParent);
    }

    return parent;
  }

  /** After the element before it in the XML, else before the existing layer after it, else last. */
  async #indexAmong(
    change: ApplyChangeData,
    parent: Holder,
    call: ApplyCall,
  ): Promise<number> {
    const siblings = call.changes.filter((other) => other.parent === change.parent);
    const at = siblings.indexOf(change);

    // The plugin's sandbox may lack ES2023's toReversed: a copy reversed in place.
    for (const before of siblings.slice(0, at).reverse()) {
      const node = call.layers.get(before.ref) as BaseNode | undefined;

      if (node !== undefined && node.parent?.id === parent.id) {
        return this.#indexIn(parent, node) + 1;
      }
    }

    for (const after of siblings.slice(at + 1)) {
      const node =
        after.kind === APPLY_CHANGE_KIND.update && after.id !== null ? await this.#lookup.node(after.id) : null;

      if (node !== null && node.parent?.id === parent.id) {
        return this.#indexIn(parent, node);
      }
    }

    return parent.children.length;
  }

  /** Next to the layer before or after names, which must sit in the element's parent. */
  async #nextTo(
    change: ApplyChangeData,
    sibling: BaseNode | null,
    parent: BaseNode | null,
  ): Promise<Place> {
    const neighbour = change.before ?? change.after ?? "";

    if (sibling === null || sibling.parent === null) {
      throw new WriteError(APPLY_TEXT.noNeighbour(neighbour));
    }

    if (parent !== null && sibling.parent.id !== parent.id) {
      throw new WriteError(APPLY_TEXT.notBeside(neighbour));
    }

    const page = this.#lookup.pageOf(sibling);

    if (page !== null) {
      await this.#pages.load(page);
    }

    const at = this.#indexIn(sibling.parent, sibling);

    return { parent: sibling.parent, index: change.before === undefined ? at + 1 : at };
  }

  #indexIn(parent: Holder, node: BaseNode): number {
    return parent.children.findIndex((child) => child.id === node.id);
  }
}

export const PLACEMENT = new InjectionToken<Placement>("Placement");
