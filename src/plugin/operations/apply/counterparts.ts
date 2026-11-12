import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_TEXT } from "@/plugin/operations/apply/apply.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

/**
 * The layers inside each copy the call made (T-126), by the copy's ref and the source's layer an element inside it
 * names: walked side by side, as a clone has the source's structure. One per call.
 */
export class Counterparts {
  readonly #copies = new Map<string, Map<string, SceneNode>>();

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

  /** The layer standing for the source's layer `id` in the copy `scope`, when the copy has one. */
  inCopy(scope: string, id: string): SceneNode | undefined {
    return this.#copies.get(scope)?.get(id);
  }

  /** The copy's layer for the source's layer a change inside it names. */
  find(change: ApplyChangeData, made: boolean): SceneNode {
    if (!made) {
      throw new WriteError(APPLY_TEXT.copyNotMade);
    }

    const node = this.inCopy(change.copy ?? "", change.source ?? "");

    if (node === undefined) {
      throw new WriteError(APPLY_TEXT.noCounterpart(change.source), APPLY_TEXT.counterpartHint);
    }

    return node;
  }
}
