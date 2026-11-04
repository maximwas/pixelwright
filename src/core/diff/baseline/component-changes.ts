import { COMPONENT_CHANGE, COMPONENT_FOLD } from "@/core/diff/baseline/baseline.constants.ts";
import type { BaselineChanges } from "@/core/diff/baseline/baseline.schema.ts";
import type { ReadSides, Side } from "@/core/diff/baseline/baseline.types.ts";
import type { LayerPairs } from "@/core/diff/baseline/layer-pairs.ts";
import { DIFF } from "@/core/diff/diff.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type Lists = Pick<BaselineChanges, "changed" | "added" | "removed">;
type ComponentEntry = BaselineChanges["components"][number];
type Change = ComponentEntry["change"];

/** A change, addition or removal as the fold reads it. */
type Listed = Pick<ComponentEntry, "attributes" | "drawing" | "xml"> & { readonly id: string; readonly tag: string };

/** Where a layer sits in a component: the nearest instance it is or is in, its component, its path inside it. */
interface InComponent {
  readonly instance: string;
  readonly component: string;
  readonly path: string;
}

/** The same change at the same place in one component's instances, waiting to be one entry. */
interface Group {
  readonly entry: Omit<ComponentEntry, "instances" | "of">;
  readonly ids: Set<string>;
  readonly instances: string[];
}

/**
 * The component fold of one comparison (K-056): a change, addition or removal two or more instances of one component
 * share, at the same place and alike, is one entry with those instances and how many of the component's instances were
 * paired (of): one change in the component's code. A change in one instance stays where it is: it may be an override.
 */
export class ComponentChanges {
  readonly #pairs: LayerPairs;
  readonly #layers: ReadSides;
  readonly #groups = new Map<string, Group>();

  constructor(pairs: LayerPairs, layers: ReadSides) {
    this.#pairs = pairs;
    this.#layers = layers;
  }

  fold(lists: Lists): Lists & Pick<BaselineChanges, "components"> {
    for (const entry of lists.changed) {
      this.#add(COMPONENT_CHANGE.changed, entry);
    }

    for (const entry of lists.added) {
      this.#add(COMPONENT_CHANGE.added, entry);
    }

    for (const entry of lists.removed) {
      this.#add(COMPONENT_CHANGE.removed, entry);
    }

    const shared = [...this.#groups.values()].filter(
      ({ instances }) => instances.length >= COMPONENT_FOLD.minInstances,
    );
    const folded = new Set(shared.flatMap(({ ids }) => [...ids]));
    const kept = ({ id }: { readonly id: string }) => !folded.has(id);

    return {
      changed: lists.changed.filter(kept),
      added: lists.added.filter(kept),
      removed: lists.removed.filter(kept),
      components: shared.map(({ entry, instances }) => ({ ...entry, instances, of: this.#paired(entry.component) })),
    };
  }

  #add(change: Change, listed: Listed): void {
    const removed = change === COMPONENT_CHANGE.removed;
    const place = removed
      ? this.#inComponent(listed.id, this.#pairs.before, this.#layers.before)
      : this.#inComponent(listed.id, this.#pairs.after, this.#layers.after);

    if (place === null) {
      return;
    }

    const { attributes, drawing, xml } = listed;
    const key = JSON.stringify([place.component, place.path, change, listed.tag, attributes ?? null, drawing ?? false]);
    const group = this.#groups.get(key) ?? {
      entry: {
        component: place.component,
        path: place.path,
        change,
        ...(attributes === undefined || Object.keys(attributes).length === 0 ? {} : { attributes }),
        ...(drawing === undefined ? {} : { drawing }),
        ...(xml === undefined ? {} : { xml }),
      },
      ids: new Set<string>(),
      instances: [],
    };
    // A removed layer's instance is named as it is now, when it is still there.
    const instance = removed ? (this.#pairs.afterOf(place.instance) ?? place.instance) : place.instance;

    group.ids.add(listed.id);

    if (!group.instances.includes(instance)) {
      group.instances.push(instance);
    }

    this.#groups.set(key, group);
  }

  /** How many instances of a component were paired on both sides. */
  #paired(component: string): number {
    return this.#pairs
      .pairs()
      .filter(([, now]) => this.#component(this.#layers.after.get(now.element.id)) === component).length;
  }

  /** The nearest instance a layer is or sits in, with its component and the layer's path inside it; null for none. */
  #inComponent(
    id: string,
    side: Side,
    layers: ReadonlyMap<string, ReadLayer>,
  ): InComponent | null {
    const labels: string[] = [];

    for (let current = side.get(id); current !== undefined; current = side.get(current.parent ?? "")) {
      const component = this.#component(layers.get(current.element.id));

      if (component !== null) {
        const path = labels.length === 0 ? COMPONENT_FOLD.instancePath : labels.join(DIFF.joiner);

        return { instance: current.element.id, component, path };
      }

      labels.unshift(current.label);
    }

    return null;
  }

  /** An instance's component: its set's name for a variant; null for any other layer. */
  #component(layer: ReadLayer | undefined): string | null {
    if (layer?.type !== COMPONENT_FOLD.instanceType || layer.instance === undefined) {
      return null;
    }

    return layer.instance.setName ?? layer.instance.componentName;
  }
}
