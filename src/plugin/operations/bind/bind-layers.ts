import { InjectionToken, inject, injectable } from "@needle-di/core";
import { SLOT_CONTENT } from "@/core/kernel/ids/slot-content.ts";
import { CURRENT_SELECTION } from "@/plugin/adapters/figma/current-selection.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { USED_TOKENS } from "@/plugin/adapters/figma/variables/used-tokens.ts";
import { BIND_SCAN_TEXT } from "@/plugin/operations/bind/bind.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** What a walk left alone: instances to their main components, layers of slots' default content to theirs. */
export interface LeftAlone {
  instances: number;
  defaults: number;
}

/**
 * The layers a bind call goes through (T-167, T-170, B-023): from `within` or the selection, depth first, each once.
 * An instance is left to its main component (what binds there belongs to the component, and an instance's own would
 * be overrides), all but what was put into its own slots, which is the instance's; with overrides every instance is
 * walked. A slot's default content never is: binding it makes no override but takes the slot from its component.
 */
@injectable()
export class BindLayers {
  readonly #used;
  readonly #selection;
  readonly #slots;

  constructor(
    used = inject(USED_TOKENS),
    selection = inject(CURRENT_SELECTION),
    slots = inject(SLOT_CONTENT),
  ) {
    this.#used = used;
    this.#selection = selection;
    this.#slots = slots;
  }

  /** `within`'s layers (a page's, every page's for "file"), else the selected ones; none selected is NODE_NOT_FOUND. */
  async roots(within: string | undefined): Promise<readonly SceneNode[]> {
    if (within !== undefined) {
      return this.#used.roots(within);
    }

    const selected = this.#selection.layers();

    if (selected.length === 0) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, BIND_SCAN_TEXT.nothingSelected);
    }

    return selected;
  }

  /** The roots and the layers under them a call binds, counting in `left` what it leaves alone. */
  *under(
    roots: readonly SceneNode[],
    overrides: boolean,
    left: LeftAlone,
  ): Generator<SceneNode> {
    const seen = new Set<string>();
    const stack = [...roots].reverse();

    for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
      if (this.#fresh(node, seen, left)) {
        const leave = !overrides && node.type === FIGMA_NODE_TYPE.instance;

        left.instances += leave ? 1 : 0;

        if (!leave) {
          yield node;
        }

        // A loop, not push(...children): a frame with tens of thousands of children would pass the argument limit.
        for (const child of [...this.#next(node, leave)].reverse()) {
          stack.push(child);
        }
      }
    }
  }

  /** A layer the walk has not seen, marked seen; a slot's default content is not one, and is counted in `left`. */
  #fresh(
    node: SceneNode,
    seen: Set<string>,
    left: LeftAlone,
  ): boolean {
    if (seen.has(node.id)) {
      return false;
    }

    seen.add(node.id);

    const isDefault = this.#isDefault(node);

    left.defaults += isDefault ? 1 : 0;

    return !isDefault;
  }

  /** What the walk goes on into: a left instance's own slots' layers, else the layer's children. */
  #next(node: SceneNode, leave: boolean): readonly SceneNode[] {
    if (leave && node.type === FIGMA_NODE_TYPE.instance) {
      return node
        .findAllWithCriteria({ types: [FIGMA_NODE_TYPE.slot] })
        .filter((slot) => this.#instanceOf(slot) === node.id)
        .flatMap((slot) => [...slot.children]);
    }

    return "children" in node ? node.children : [];
  }

  /** Whether a layer is a slot's default content (T-170). */
  #isDefault(node: SceneNode): boolean {
    const parent = node.parent;

    return parent !== null && parent.type === FIGMA_NODE_TYPE.slot && this.#slots.isDefault(node.id, parent.id);
  }

  /** The instance a slot belongs to: the nearest above it; a slot of an instance inside it is that instance's. */
  #instanceOf(node: BaseNode): string | null {
    let up = node.parent;

    while (up !== null && up.type !== FIGMA_NODE_TYPE.instance) {
      up = up.parent;
    }

    return up === null ? null : up.id;
  }
}

export const BIND_LAYERS = new InjectionToken<BindLayers>("BindLayers");
