import { InjectionToken, inject, injectable } from "@needle-di/core";
import { HINT_LABEL } from "@/core/design/hints/hints.constants.ts";
import { LAYER_SHAPE } from "@/core/design/hints/structure/layer-shape.ts";
import {
  CHILDREN_MIN,
  ROOM_SLACK,
  STATE_LAYERS_MIN,
  STATE_SHARE,
  STRUCTURE_FIGMA,
  STRUCTURE_TEXT,
} from "@/core/design/hints/structure/structure.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";

/** A top-level frame and how many of its layers have each structure. */
interface FrameShapes {
  readonly frame: ReadLayer;
  readonly shapes: ReadonlyMap<string, number>;
  readonly size: number;
}

/**
 * Top-level frames of one width sharing most of their layers (Q-007): states of one component drawn as frames. Each
 * frame joins the first earlier one it matches; frames of other widths are breakpoints, not states.
 */
@injectable()
export class SharedLayers {
  readonly #readLayers = new ReadLayers();
  readonly #shape;

  constructor(shape = inject(LAYER_SHAPE)) {
    this.#shape = shape;
  }

  read(root: ReadLayer): string[] {
    const clusters: FrameShapes[][] = [];

    for (const frame of root.children ?? []) {
      const entry = frame.visible && frame.type === STRUCTURE_FIGMA.frame ? this.#shapes(frame) : null;

      if (entry !== null && entry.size >= STATE_LAYERS_MIN) {
        const cluster = clusters.find(([head]) => head !== undefined && this.#states(head, entry));

        if (cluster === undefined) {
          clusters.push([entry]);
        } else {
          cluster.push(entry);
        }
      }
    }

    const examples = clusters
      .filter((cluster) => cluster.length >= CHILDREN_MIN)
      .map((cluster) =>
        STRUCTURE_TEXT.statesExample(cluster.map(({ frame }) => HINT_LABEL.layer(frame.id, frame.name))),
      );

    return examples.length === 0 ? [] : [STRUCTURE_TEXT.states(examples)];
  }

  #states(one: FrameShapes, other: FrameShapes): boolean {
    let shared = 0;

    for (const [key, count] of one.shapes) {
      shared += Math.min(count, other.shapes.get(key) ?? 0);
    }

    return (
      Math.abs(one.frame.width - other.frame.width) <= ROOM_SLACK &&
      shared >= STATE_SHARE * Math.max(one.size, other.size)
    );
  }

  /** Every visible layer under the frame, counted by its structure. */
  #shapes(frame: ReadLayer): FrameShapes {
    const shapes = new Map<string, number>();

    for (const { layer } of this.#readLayers.walk(frame, (each) => each.visible)) {
      if (layer !== frame) {
        const key = this.#shape.key(layer);

        shapes.set(key, (shapes.get(key) ?? 0) + 1);
      }
    }

    return { frame, shapes, size: [...shapes.values()].reduce((sum, count) => sum + count, 0) };
  }
}

export const SHARED_LAYERS = new InjectionToken<SharedLayers>("SharedLayers");
