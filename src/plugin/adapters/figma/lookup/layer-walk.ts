import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { WALK } from "@/plugin/adapters/figma/lookup/lookup.constants.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";

/** What a walk keeps: the items it accepts, until it has enough of them. */
export interface WalkKeep<Item> {
  readonly accepts: (item: Item) => boolean;
  readonly enough: number;
}

/** How a walk looks its items up: each one's lookup, what to do with its answer, and when it has enough. */
export interface WalkLookup<Item, Value> {
  readonly lookup: (item: Item) => Promise<Value>;
  readonly take: (item: Item, value: Value) => void;
  readonly enough: () => boolean;
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

  /** When an op's walk must end: its budget from now, LIMITS.opBudgetMs unless given, under the server's wait. */
  deadline(budgetMs: number = LIMITS.opBudgetMs): number {
    return this.#clock.now() + budgetMs;
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

  /**
   * Looks the items up LIMITS.mainComponentBatch at a time, in order, each answer taken, until `enough` or the deadline;
   * true when the deadline cut it. The first batch goes even past the deadline, so a walk that spent the time still
   * answers with what it reached (P-075, T-040): the clock is read before each later batch.
   */
  async lookUp<Item, Value>(
    items: readonly Item[],
    deadline: number,
    lookup: WalkLookup<Item, Value>,
  ): Promise<boolean> {
    for (let start = 0; start < items.length && !lookup.enough(); start += LIMITS.mainComponentBatch) {
      if (start > 0 && this.passed(deadline)) {
        return true;
      }

      const batch = items.slice(start, start + LIMITS.mainComponentBatch);
      const answers = await Promise.all(batch.map(async (item) => [item, await lookup.lookup(item)] as const));

      for (const [item, value] of answers) {
        lookup.take(item, value);
      }
    }

    return false;
  }
}

export const LAYER_WALK = new InjectionToken<LayerWalk>("LayerWalk");
