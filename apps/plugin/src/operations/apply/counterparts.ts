import type { ApplyChange } from "@pixelwright/core";
import { instancePath } from "../../figma/nodes.ts";
import { WriteError } from "../../figma/write-error.ts";

/**
 * The layers inside each copy and new instance the call made, by its ref and the layer an element inside it names: a
 * copy's by the source's ids, a new instance's by the ids inside any instance of its component.
 */
export class Counterparts {
  readonly #layers = new Map<string, SceneNode>();

  /** A copy's layers by the source's: walked side by side, as a clone has the source's structure. */
  pairCopy(ref: string, source: BaseNode, copy: SceneNode): void {
    this.#layers.set(`${ref} ${source.id}`, copy);

    const copies = "children" in copy ? copy.children : [];

    ("children" in source ? source.children : []).forEach((child, index) => {
      const twin = copies[index];

      if (twin !== undefined) {
        this.pairCopy(ref, child, twin);
      }
    });
  }

  /** A new instance's layers by their ids inside it: another instance's ids of the same component name the same ones. */
  pairInstance(ref: string, instance: SceneNode): void {
    for (const layer of "children" in instance ? instance.children : []) {
      this.#layers.set(`${ref} ${instancePath(layer.id)}`, layer);
      this.pairInstance(ref, layer);
    }
  }

  /** The counterpart of the layer a change names, in the copy or the new instance it is in. */
  find(change: ApplyChange, { inCopy, made }: { readonly inCopy: boolean; readonly made: boolean }): SceneNode {
    if (!made) {
      throw new WriteError(
        `The ${inCopy ? "copy" : "instance"} it is in was not made: fix that element's error first.`,
      );
    }

    const node = this.#layers.get(`${change.copy ?? ""} ${inCopy ? change.source : instancePath(change.source ?? "")}`);

    if (node !== undefined) {
      return node;
    }

    throw inCopy
      ? new WriteError(
          `The copy has no layer for ${change.source}.`,
          "Inside a copy, name only layers of the copied one, where they are in it.",
        )
      : new WriteError(
          `The new instance has no layer for ${change.source}.`,
          "Inside a new instance, name its layers by another instance's ids of the same component and variant, or by the component's own.",
        );
  }
}
