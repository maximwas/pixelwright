import { serializeDesign } from "../../design/serializer.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { isCut, type LayerPairs, type Placed } from "./layer-pairs.ts";
import type { BaselineChanges } from "./types.ts";

/** The longest XML an added layer carries, and the most all of an answer's additions carry together. */
const INLINE_XML_CHARS = 4_000;
const INLINE_XML_BUDGET = 20_000;

/** The snapshots' layers by id: what hid a layer on either side. */
export interface StructureSources {
  readonly before: ReadonlyMap<string, SnapshotNode>;
  readonly after: ReadonlyMap<string, SnapshotNode>;
}

type Structure = Pick<BaselineChanges, "added" | "removed" | "moved" | "reordered">;

/**
 * The layers added and removed (only the topmost of each new or gone branch; hidden ones say so), the layers moved to
 * another parent, and the parents whose paired children come in another order.
 */
export function structureChanges(pairs: LayerPairs, sources: StructureSources): Structure {
  const budget = new XmlBudget();

  return {
    added: topmost(pairs.unpairedAfter()).map((placed) => ({
      path: placed.path,
      id: placed.element.id,
      tag: placed.element.tag,
      ...(sources.before.get(placed.element.id)?.visible === false ? { was: "hidden" as const } : {}),
      ...budget.xmlOf(placed),
    })),
    removed: topmost(pairs.unpairedBefore()).map((placed) => ({
      path: placed.path,
      id: placed.element.id,
      tag: placed.element.tag,
      ...(sources.after.get(placed.element.id)?.visible === false ? { now: "hidden" as const } : {}),
    })),
    moved: movedLayers(pairs),
    reordered: reorderedParents(pairs),
  };
}

/** The pairs whose children the snapshot's budget cut on either side: compared themselves, nothing under them. */
export function cutPairs(pairs: LayerPairs): BaselineChanges["notCompared"] {
  return pairs
    .pairs()
    .filter(([before, now]) => isCut(before.element) || isCut(now.element))
    .map(([, now]) => ({
      path: now.path,
      id: now.element.id,
      what: "children" as const,
    }));
}

/** The XML of added layers, each up to a size and all of them up to a budget. */
class XmlBudget {
  #left = INLINE_XML_BUDGET;

  xmlOf(placed: Placed): { xml?: string } {
    const { xml } = serializeDesign(placed.element);

    if (xml.length > INLINE_XML_CHARS || xml.length > this.#left) {
      return {};
    }

    this.#left -= xml.length;

    return { xml };
  }
}

/** Only the layers whose parent is not in the list too: the top of each branch. */
function topmost(layers: readonly Placed[]): Placed[] {
  const listed = new Set(layers.map(({ element }) => element.id));

  return layers.filter((placed) => placed.parent === null || !listed.has(placed.parent));
}

/** Pairs whose parents are not a pair: the layer went to another parent. */
function movedLayers(pairs: LayerPairs): BaselineChanges["moved"] {
  return pairs.pairs().flatMap(([before, now]) => {
    if (before.parent === null || now.parent === null || pairs.afterOf(before.parent) === now.parent) {
      return [];
    }

    return [
      {
        path: now.path,
        id: now.element.id,
        from: pairs.before.get(before.parent)?.path ?? before.parent,
      },
    ];
  });
}

/** For each pair of parents, the children paired under both, when they come in another order. */
function reorderedParents(pairs: LayerPairs): BaselineChanges["reordered"] {
  return pairs.pairs().flatMap(([before, now]) => {
    const kept = now.element.children.filter((child) => {
      const pairedBefore = pairs.beforeOf(child.id);

      return pairedBefore !== undefined && pairs.before.get(pairedBefore)?.parent === before.element.id;
    });
    const beforeOrder = before.element.children.filter((child) => {
      const pairedNow = pairs.afterOf(child.id);

      return pairedNow !== undefined && kept.some((each) => each.id === pairedNow);
    });

    if (beforeOrder.every((child, index) => pairs.afterOf(child.id) === kept[index]?.id)) {
      return [];
    }

    return [
      {
        path: now.path,
        id: now.element.id,
        before: beforeOrder.map((child) => pairs.before.get(child.id)?.label ?? child.id),
        after: kept.map((child) => pairs.after.get(child.id)?.label ?? child.id),
      },
    ];
  });
}
