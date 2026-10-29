import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { WALK } from "@/plugin/adapters/figma/lookup/lookup.constants.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";

/** What a walk keeps: the items it accepts, until it has enough of them. */
export interface WalkKeep<Item> {
  readonly accepts: (item: Item) => boolean;
  readonly enough: number;
}

/** What a walk kept, in order, and whether its deadline cut it short. */
export interface Walked<Item> {
  readonly kept: Item[];
  readonly cut: boolean;
}

/**
 * Walks through layers with a deadline (P-075): Figma's findAll cannot be stopped, and on a big page it can outlast the
 * server's wait, so an op goes layer by layer and answers with what it has when its time is spent.
 */
@injectable()
export class LayerWalk {
  readonly #clock;

  constructor(clock = inject(CLOCK)) {
    this.#clock = clock;
  }

  /** When an op's walk must end: LIMITS.opBudgetMs from now, under the server's wait for the op. */
  deadline(): number {
    return this.#clock.now() + LIMITS.opBudgetMs;
  }

  passed(deadline: number): boolean {
    return this.#clock.now() > deadline;
  }

  /** The roots and the layers under them, depth first in document order (findAll's), each once however roots nest. */
  *layers(roots: readonly SceneNode[]): Generator<SceneNode> {
    const seen = new Set<string>();
    const stack = [...roots].reverse();

    for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
      if (!seen.has(node.id)) {
        seen.add(node.id);

        yield node;

        // A loop, not push(...children): a frame with tens of thousands of children would pass the argument limit.
        for (const child of "children" in node ? [...node.children].reverse() : []) {
          stack.push(child);
        }
      }
    }
  }

  /**
   * The items `keep` accepts, in order, until it has enough or the deadline passes. The clock is read once every
   * WALK.checkEvery items: reading it per layer slows a big walk, and a walk checked only at its end never stops early.
   */
  until<Item>(
    items: Iterable<Item>,
    deadline: number,
    keep: WalkKeep<Item>,
  ): Walked<Item> {
    const kept: Item[] = [];
    let seen = 0;

    for (const item of items) {
      if (seen % WALK.checkEvery === 0 && this.passed(deadline)) {
        return { kept, cut: true };
      }

      seen += 1;

      if (keep.accepts(item)) {
        kept.push(item);

        if (kept.length >= keep.enough) {
          break;
        }
      }
    }

    return { kept, cut: false };
  }
}

export const LAYER_WALK = new InjectionToken<LayerWalk>("LayerWalk");
