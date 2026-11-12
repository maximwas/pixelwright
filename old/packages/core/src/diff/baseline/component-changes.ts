import type { SnapshotNode } from "../../types/snapshot.ts";
import type { LayerPairs, Side } from "./layer-pairs.ts";
import type { BaselineChanges, Pair } from "./types.ts";

type Lists = Pick<BaselineChanges, "changed" | "added" | "removed">;
type Change = "changed" | "added" | "removed";

/** The snapshots' layers by id, and the pairs: what tells an instance and its component. */
export interface FoldSources {
  readonly pairs: LayerPairs;
  readonly before: ReadonlyMap<string, SnapshotNode>;
  readonly after: ReadonlyMap<string, SnapshotNode>;
}

/** One change inside an instance: the instance, its component, and where in it the change is. */
interface InComponent {
  readonly instance: string;
  readonly component: string;
  readonly path: string;
}

/** Changes that two or more instances of one component share, waiting to be one entry. */
interface Group {
  readonly key: InComponent & { change: Change };
  readonly entry: { attributes?: Record<string, Pair>; drawing?: true; xml?: string };
  readonly ids: Set<string>;
  readonly instances: string[];
}

/**
 * A change, addition or removal that two or more instances of one component share, as one entry with those instances
 * and how many of the component's instances were compared (of): one change in the component's code. A change in one
 * instance stays where it is, since it may be an override.
 */
export function foldComponents(lists: Lists, sources: FoldSources): Lists & Pick<BaselineChanges, "components"> {
  const groups = new ComponentGroups(sources);

  for (const entry of lists.changed) {
    groups.add(entry.id, "changed", entry);
  }

  for (const entry of lists.added) {
    groups.add(entry.id, "added", entry);
  }

  for (const entry of lists.removed) {
    groups.add(entry.id, "removed", entry);
  }

  const folded = groups.folded();

  return {
    changed: lists.changed.filter((entry) => !folded.ids.has(entry.id)),
    added: lists.added.filter((entry) => !folded.ids.has(entry.id)),
    removed: lists.removed.filter((entry) => !folded.ids.has(entry.id)),
    components: folded.components,
  };
}

/** The changes inside instances, grouped by component, place in it, and what changed. */
class ComponentGroups {
  readonly #sources: FoldSources;
  readonly #groups = new Map<string, Group>();

  constructor(sources: FoldSources) {
    this.#sources = sources;
  }

  add(
    id: string,
    change: Change,
    entry: { attributes?: Record<string, Pair>; drawing?: true; xml?: string; tag: string },
  ): void {
    const side = change === "removed" ? this.#sources.pairs.before : this.#sources.pairs.after;
    const nodes = change === "removed" ? this.#sources.before : this.#sources.after;
    const place = inComponent(id, side, nodes);

    if (place === null) {
      return;
    }

    const key = JSON.stringify([
      place.component,
      place.path,
      change,
      entry.tag,
      entry.attributes ?? null,
      entry.drawing ?? false,
    ]);
    const group = this.#groups.get(key) ?? {
      key: {
        ...place,
        change,
      },
      entry: {
        ...(entry.attributes === undefined || Object.keys(entry.attributes).length === 0
          ? {}
          : { attributes: entry.attributes }),
        ...(entry.drawing === undefined ? {} : { drawing: entry.drawing }),
        ...(entry.xml === undefined ? {} : { xml: entry.xml }),
      },
      ids: new Set<string>(),
      instances: [],
    };
    const instance =
      change === "removed" ? (this.#sources.pairs.afterOf(place.instance) ?? place.instance) : place.instance;

    group.ids.add(id);

    if (!group.instances.includes(instance)) {
      group.instances.push(instance);
    }

    this.#groups.set(key, group);
  }

  /** The groups two or more instances share, as entries, and the ids they took from the other lists. */
  folded(): { components: BaselineChanges["components"]; ids: Set<string> } {
    const shared = [...this.#groups.values()].filter((group) => group.instances.length >= 2);

    return {
      components: shared.map((group) => ({
        component: group.key.component,
        path: group.key.path,
        change: group.key.change,
        ...group.entry,
        instances: group.instances,
        of: this.#pairedInstances(group.key.component),
      })),
      ids: new Set(shared.flatMap((group) => [...group.ids])),
    };
  }

  /** How many instances of a component were paired on both sides. */
  #pairedInstances(component: string): number {
    return this.#sources.pairs
      .pairs()
      .filter(([, now]) => componentOf(this.#sources.after.get(now.element.id)) === component).length;
  }
}

/** The nearest instance a layer is or sits in, with its component and the layer's path inside it; null for none. */
function inComponent(id: string, side: Side, nodes: ReadonlyMap<string, SnapshotNode>): InComponent | null {
  const labels: string[] = [];

  for (let current = side.get(id); current !== undefined; current = side.get(current.parent ?? "")) {
    const component = componentOf(nodes.get(current.element.id));

    if (component !== null) {
      return {
        instance: current.element.id,
        component,
        path: labels.length === 0 ? "(instance)" : labels.toReversed().join(" / "),
      };
    }

    labels.push(current.label);
  }

  return null;
}

/** An instance's component: its set's name for a variant; null for any other layer. */
function componentOf(node: SnapshotNode | undefined): string | null {
  return node?.type === "INSTANCE" && node.instance !== undefined
    ? (node.instance.setName ?? node.instance.componentName)
    : null;
}
