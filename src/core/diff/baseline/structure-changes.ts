import { InjectionToken, inject, injectable } from "@needle-di/core";
import { BASELINE_CHANGE, NOT_COMPARED } from "@/core/diff/baseline/baseline.constants.ts";
import type { BaselineChanges } from "@/core/diff/baseline/baseline.schema.ts";
import type { Placed, ReadSides } from "@/core/diff/baseline/baseline.types.ts";
import type { LayerPairs } from "@/core/diff/baseline/layer-pairs.ts";
import { XML_WRITER } from "@/core/xml/xml-writer.ts";

/** The layers added, removed, moved to another parent, and the parents reordered. */
interface Structure {
  readonly added: BaselineChanges["added"];
  readonly removed: BaselineChanges["removed"];
  readonly moved: BaselineChanges["moved"];
  readonly reordered: BaselineChanges["reordered"];
}

/**
 * How the layers' places changed (T-205, K-055): the layers added and removed, only the topmost of each new or gone
 * branch, a hidden one saying so and an added one with its XML when short; the layers moved to another parent with
 * where they were; the parents whose paired children come in another order; the pairs a read's budget cut.
 */
@injectable()
export class StructureChanges {
  readonly #writer;

  constructor(writer = inject(XML_WRITER)) {
    this.#writer = writer;
  }

  of(pairs: LayerPairs, sides: ReadSides): Structure {
    let budget = BASELINE_CHANGE.xmlBudget;
    const added = this.#topmost(pairs.unpairedAfter()).map((placed) => {
      const xml = this.#writer.xml(placed.element);
      const carried = xml.length <= BASELINE_CHANGE.inlineXml && xml.length <= budget;

      budget -= carried ? xml.length : 0;

      return {
        ...this.#at(placed),
        tag: placed.element.tag,
        ...(sides.before.get(placed.element.id)?.visible === false ? { was: BASELINE_CHANGE.hidden } : {}),
        ...(carried ? { xml } : {}),
      };
    });
    const removed = this.#topmost(pairs.unpairedBefore()).map((placed) => ({
      ...this.#at(placed),
      tag: placed.element.tag,
      ...(sides.after.get(placed.element.id)?.visible === false ? { now: BASELINE_CHANGE.hidden } : {}),
    }));

    return { added, removed, moved: this.#moved(pairs), reordered: this.#reordered(pairs) };
  }

  /** The pairs whose children a read's budget cut on either side: compared themselves, nothing under them. */
  cut(pairs: LayerPairs): BaselineChanges["notCompared"] {
    return pairs
      .pairs()
      .filter(([before, now]) => pairs.cut(before.element) || pairs.cut(now.element))
      .map(([, now]) => ({ ...this.#at(now), what: NOT_COMPARED.children }));
  }

  #at(placed: Placed): { path: string; id: string } {
    return { path: placed.path, id: placed.element.id };
  }

  /** Only the layers whose parent is not in the list too: the top of each branch. */
  #topmost(layers: readonly Placed[]): Placed[] {
    const listed = new Set(layers.map(({ element }) => element.id));

    return layers.filter((placed) => placed.parent === null || !listed.has(placed.parent));
  }

  /** Pairs whose parents are not a pair: the layer went to another parent. */
  #moved(pairs: LayerPairs): BaselineChanges["moved"] {
    return pairs.pairs().flatMap(([before, now]) => {
      if (before.parent === null || now.parent === null || pairs.afterOf(before.parent) === now.parent) {
        return [];
      }

      return [{ ...this.#at(now), from: pairs.before.get(before.parent)?.path ?? before.parent }];
    });
  }

  /** For each pair of parents, the children paired under both, when they come in another order. */
  #reordered(pairs: LayerPairs): BaselineChanges["reordered"] {
    return pairs.pairs().flatMap(([before, now]) => {
      const kept = now.element.children.filter((child) => {
        const pairedBefore = pairs.beforeOf(child.id);

        return pairedBefore !== undefined && pairs.before.get(pairedBefore)?.parent === before.element.id;
      });
      const keptIds = new Set(kept.map(({ id }) => id));
      const beforeOrder = before.element.children.filter((child) => keptIds.has(pairs.afterOf(child.id) ?? ""));

      if (beforeOrder.every((child, index) => pairs.afterOf(child.id) === kept[index]?.id)) {
        return [];
      }

      return [
        {
          ...this.#at(now),
          before: beforeOrder.map((child) => pairs.before.get(child.id)?.label ?? child.id),
          after: kept.map((child) => pairs.after.get(child.id)?.label ?? child.id),
        },
      ];
    });
  }
}

export const STRUCTURE_CHANGES = new InjectionToken<StructureChanges>("StructureChanges");
