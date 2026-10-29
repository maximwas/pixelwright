import { InjectionToken, inject, injectable } from "@needle-di/core";
import { HINT_LABEL } from "@/core/design/hints/hints.constants.ts";
import type { ShownLayer } from "@/core/design/hints/hints.types.ts";
import { LAYER_SHAPE } from "@/core/design/hints/structure/layer-shape.ts";
import {
  CHILDREN_MIN,
  REPEAT_MIN,
  STRUCTURE_FIGMA,
  STRUCTURE_TEXT,
} from "@/core/design/hints/structure/structure.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";

/**
 * Frames and groups built alike REPEAT_MIN times or more outside any component (Q-002): a component to make. Of nested
 * repeats only the outermost speaks; instances and the layers inside them are components already.
 */
@injectable()
export class AlikeStructures {
  readonly #readLayers = new ReadLayers();
  readonly #shape;

  constructor(shape = inject(LAYER_SHAPE)) {
    this.#shape = shape;
  }

  read(layers: readonly ShownLayer[]): string[] {
    const parents = new Map(layers.map(({ layer, parent }) => [layer, parent]));
    const groups = new Map<string, ReadLayer[]>();

    for (const { layer } of layers) {
      if (this.#built(layer)) {
        const key = this.#shape.key(layer);

        groups.set(key, [...(groups.get(key) ?? []), layer]);
      }
    }

    const kept = new Set<ReadLayer>();
    const examples: string[] = [];

    for (const members of groups.values()) {
      const [first] = members;

      if (
        first !== undefined &&
        members.length >= REPEAT_MIN &&
        !members.every((member) => this.#inside(member, kept, parents))
      ) {
        for (const member of members) {
          kept.add(member);
        }

        examples.push(STRUCTURE_TEXT.repeatedExample(HINT_LABEL.layer(first.id, first.name), members.length - 1));
      }
    }

    return examples.length === 0 ? [] : [STRUCTURE_TEXT.repeated(examples)];
  }

  /** A frame or group of a few layers, built by hand. */
  #built(layer: ReadLayer): boolean {
    const children = this.#readLayers.visibleChildren(layer);

    return (
      (layer.type === STRUCTURE_FIGMA.frame || layer.type === STRUCTURE_FIGMA.group) &&
      !layer.id.startsWith(STRUCTURE_FIGMA.inInstance) &&
      children.length >= CHILDREN_MIN
    );
  }

  #inside(
    layer: ReadLayer,
    kept: ReadonlySet<ReadLayer>,
    parents: ReadonlyMap<ReadLayer, ReadLayer | null>,
  ): boolean {
    for (let parent = parents.get(layer) ?? null; parent !== null; parent = parents.get(parent) ?? null) {
      if (kept.has(parent)) {
        return true;
      }
    }

    return false;
  }
}

export const ALIKE_STRUCTURES = new InjectionToken<AlikeStructures>("AlikeStructures");
