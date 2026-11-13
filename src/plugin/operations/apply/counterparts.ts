import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_PATTERN, APPLY_TEXT } from "@/plugin/operations/apply/apply.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

/**
 * The layers inside each copy and new instance the call made (T-126, T-127), by its ref and the layer an element inside
 * it names: a copy's by the source's ids, walked side by side as a clone has the source's structure; a new instance's
 * by the ids inside any instance of its component, which differ in their I<instance>; part alone. One per call.
 */
export class Counterparts {
  readonly #copies = new Map<string, Map<string, SceneNode>>();
  readonly #instances = new Set<string>();

  pairCopy(
    ref: string,
    source: BaseNode,
    copy: SceneNode,
  ): void {
    const layers = this.#copies.get(ref) ?? new Map<string, SceneNode>();

    this.#copies.set(ref, layers);
    layers.set(source.id, copy);

    const copies = "children" in copy ? copy.children : [];

    ("children" in source ? source.children : []).forEach((child, index) => {
      const twin = copies[index];

      if (twin !== undefined) {
        this.pairCopy(ref, child, twin);
      }
    });
  }

  /** A new instance's layers by their ids inside it, less the I<instance>; part. */
  pairInstance(ref: string, instance: SceneNode): void {
    const layers = this.#copies.get(ref) ?? new Map<string, SceneNode>();

    this.#copies.set(ref, layers);
    this.#instances.add(ref);

    for (const layer of "children" in instance ? instance.children : []) {
      layers.set(this.#inside(layer.id), layer);
      this.pairInstance(ref, layer);
    }
  }

  /** The layer standing for the source's layer `id` in the copy or new instance `scope`, when it has one. */
  inCopy(scope: string, id: string): SceneNode | undefined {
    return this.#copies.get(scope)?.get(this.#instances.has(scope) ? this.#inside(id) : id);
  }

  /** The copy's or new instance's layer for the source's layer a change inside it names. */
  find(change: ApplyChangeData): SceneNode {
    const scope = change.copy ?? "";
    const node = this.inCopy(scope, change.source ?? "");

    if (node !== undefined) {
      return node;
    }

    throw this.#instances.has(scope)
      ? new WriteError(APPLY_TEXT.noInstanceLayer(change.source), APPLY_TEXT.instanceLayerHint)
      : new WriteError(APPLY_TEXT.noCounterpart(change.source), APPLY_TEXT.counterpartHint);
  }

  /** A layer's id as it is in every instance of its component: without the I<instance>; it starts with in one. */
  #inside(id: string): string {
    return id.replace(APPLY_PATTERN.instanceLayer, "");
  }
}
