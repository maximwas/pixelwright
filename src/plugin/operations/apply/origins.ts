import type { Holder } from "@/plugin/operations/apply/apply.types.ts";

/** An existing layer the call moved: the parent it stood in and its index there. */
interface Origin {
  readonly node: SceneNode;
  readonly parent: Holder;
  readonly index: number;
}

/**
 * Where each existing layer the call moved stood before it moved. A layer the call made goes with what it holds when
 * its mark cannot bind; what was there before the call is not the call's to take away, so it goes back first. One per
 * call.
 */
export class Origins {
  readonly #moved: Origin[] = [];

  /** A layer's place before a move writes it. */
  record(node: SceneNode): void {
    const parent = node.parent as Holder | null;

    if (parent !== null) {
      this.#moved.push({ node, parent, index: parent.children.indexOf(node) });
    }
  }

  /**
   * The layers moved into `inside`, at any depth, back where they stood, the last moved first so each finds the list
   * as it was when it moved. A layer moved more than once goes back from its latest move only: the earlier ones were
   * the call's own and stay for a later restore (the layer it went into goes too). A layer that cannot go back throws
   * and the rest stay where they are.
   */
  restore(inside: SceneNode): void {
    const held = this.#moved.filter(
      (origin, position) => this.#within(origin.node, inside) && this.#latest(origin, position),
    );

    // The plugin's sandbox may lack ES2023's toReversed: a copy reversed in place.
    for (const origin of held.reverse()) {
      const { node, parent, index } = origin;

      parent.insertChild(Math.min(index, parent.children.length), node);
      this.#moved.splice(this.#moved.indexOf(origin), 1);
    }
  }

  /** Whether no later record is of the same layer: its latest move is the one that put it where it now is. */
  #latest(origin: Origin, position: number): boolean {
    return !this.#moved.slice(position + 1).some(({ node }) => node.id === origin.node.id);
  }

  #within(node: BaseNode, inside: BaseNode): boolean {
    for (let up = node.parent; up !== null; up = up.parent) {
      if (up.id === inside.id) {
        return true;
      }
    }

    return false;
  }
}
