import type { ApplyChange } from "@pixelwright/core";
import type { ComponentIndex } from "../../figma/component-index.ts";
import { indexIn } from "../../figma/nodes.ts";
import { WriteError } from "../../figma/write-error.ts";
import { finishNew } from "./new-layers.ts";
import type { PropertyMarks } from "./property-marks.ts";
import { layOut } from "./variant-grid.ts";
import { PLACING_KEYS } from "./writers/child-steps.ts";

type Fail = (error: unknown, attribute?: string) => void;

/** A layer's write that waits: its layer, its change, where its errors go. */
interface Held {
  readonly node: SceneNode;
  readonly change: ApplyChange;
  readonly fail: Fail;
}

/** A new set waiting for its variants: the frame holding them until they are combined, and their placing in it. */
interface Pending {
  readonly change: ApplyChange;
  readonly holder: SceneNode;
  readonly fail: Fail;
  readonly placing: Held[];
}

/** What finishing a set needs from the run: its writer, its record, its components, marks and layers. */
export interface SetFinishing {
  write(node: SceneNode, change: ApplyChange, fail: Fail): Promise<unknown>;
  made(change: ApplyChange, node: SceneNode): void;
  readonly components: ComponentIndex;
  readonly marks: PropertyMarks;
  readonly layers: Map<string, PageNode | SceneNode | null>;
}

/**
 * New component sets waiting for their variants: each is held in a frame until its XML has ended, then combined from
 * its variants where the frame was, laid out and written; then the properties its components' layers make are bound.
 */
export class PendingSets {
  readonly #pending: Pending[] = [];
  readonly #byRef: ReadonlyMap<string, ApplyChange>;
  readonly #run: SetFinishing;

  constructor(byRef: ReadonlyMap<string, ApplyChange>, run: SetFinishing) {
    this.#byRef = byRef;
    this.#run = run;
  }

  hold(change: ApplyChange, holder: SceneNode, fail: Fail): void {
    this.#pending.push({
      change,
      holder,
      fail,
      placing: [],
    });
  }

  /**
   * The change to write now. A variant of a set still held is written in its holder, which has no layout: what places
   * it in the set (a grid cell, its alignment) waits until the set is made with its own.
   */
  writable({ node, change, fail }: Held): ApplyChange {
    const set = this.#pending.find((pending) => pending.change.ref === change.parent);
    const keys = Object.keys(change.props);

    if (set === undefined || !keys.some((key) => PLACING_KEYS.has(key))) {
      return change;
    }

    const part = (placing: boolean) =>
      Object.fromEntries(Object.entries(change.props).filter(([key]) => PLACING_KEYS.has(key) === placing));

    set.placing.push({
      node,
      change: {
        ...change,
        props: part(true),
      },
      fail,
    });

    return {
      ...change,
      props: part(false),
    };
  }

  /** Sets whose XML has ended (none holds `next`) are finished; a set still open waits, and the properties inside it. */
  async settle(next?: ApplyChange): Promise<void> {
    const open = new Set(next === undefined ? [] : ancestorsOf(next, this.#byRef));
    const ready = this.#pending.filter(({ change }) => !open.has(change.ref));

    this.#pending.splice(0, this.#pending.length, ...this.#pending.filter(({ change }) => open.has(change.ref)));

    for (const pending of ready) {
      await this.#finish(pending);
    }

    this.#run.marks.bindOutside(new Set(this.#pending.map(({ holder }) => holder.id)));
  }

  async #finish(pending: Pending): Promise<void> {
    const made = combine(pending);

    if (made === null) {
      return;
    }

    this.#run.layers.set(pending.change.ref, made);

    try {
      await this.#run.write(made, pending.change, pending.fail);

      // A set with auto layout or a grid lays its variants out itself, placed by what waited for it.
      if (made.layoutMode === "NONE") {
        layOut(made);
      }

      for (const { node, change, fail } of pending.placing) {
        await this.#run.write(node, change, fail);
      }

      // As any new layer: it hugs what the XML did not size, and on the page it goes beside what is there.
      finishNew(made, pending.change);
      this.#run.components.add(made);
      this.#run.made(pending.change, made);
    } catch (error) {
      pending.fail(error);
    }
  }
}

/** The refs of the elements holding a change, the nearest first. */
function ancestorsOf(change: ApplyChange, byRef: ReadonlyMap<string, ApplyChange>): string[] {
  const refs: string[] = [];

  for (let ref = change.parent; ref !== null; ref = byRef.get(ref)?.parent ?? null) {
    refs.push(ref);
  }

  return refs;
}

/** A new set's variants combined where their holder is; the holder goes, and with it a set that fails. */
function combine({ holder, fail }: Pending): ComponentSetNode | null {
  const variants = ("children" in holder ? holder.children : []).filter(
    (child): child is ComponentNode => child.type === "COMPONENT",
  );

  try {
    if (variants.length === 0 || holder.parent === null) {
      throw new WriteError("A <ComponentSet> is made of its <Component> variants: this one has none.");
    }

    const made = figma.combineAsVariants(variants, holder.parent, indexIn(holder.parent, holder));

    holder.remove();

    return made;
  } catch (error) {
    // Nothing half made stays: the holder goes, with the variants it holds.
    if (holder.parent !== null) {
      holder.remove();
    }

    fail(error);

    return null;
  }
}
