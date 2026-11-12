import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CAPABILITIES, type TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY, CAPABILITY_TEXT, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_TEXT, NEW_LAYER_TYPE, TEXT_TAG } from "@/plugin/operations/apply/apply.constants.ts";
import { WRITE_STEPS } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { HIDDEN_KEY } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** One refusal: its error, the props it leaves unwritten, and whether it is the text's. */
export interface Refusal {
  readonly error: unknown;
  readonly keys: readonly (keyof FigmaProps)[];
  readonly text?: boolean;
}

/**
 * The checks a dry and a real run share (A§6.2 step 7): the layer an id names is there with the type its tag says, a
 * new layer's tag is made and its parent holds layers, and what the layer's type cannot take is refused before any
 * write, each step by the capability it names (P-079); a prop no step writes yet is refused on its attribute.
 */
@injectable()
export class ApplyChecks {
  readonly #lookup;
  readonly #pages;
  readonly #capabilities;
  readonly #steps;

  constructor(
    lookup = inject(NODE_LOOKUP),
    pages = inject(PAGE_LOADER),
    capabilities = inject(CAPABILITIES),
    steps = inject(WRITE_STEPS, { multi: true }),
  ) {
    this.#lookup = lookup;
    this.#pages = pages;
    this.#capabilities = capabilities;
    this.#steps = steps;
  }

  /** Where top-level new layers go: the layer or page by id (NODE_NOT_FOUND when gone), else the current page. */
  async top(id: string | undefined): Promise<BaseNode> {
    const node = await this.#pages.root(id);
    const page = this.#lookup.pageOf(node);

    if (page !== null) {
      await this.#pages.load(page);
    }

    return node;
  }

  /** The layer an update writes, its tag matching its type; its page loaded on a real run. */
  async existing(change: ApplyChangeData, load: boolean): Promise<SceneNode> {
    if (change.source !== undefined) {
      throw new WriteError(APPLY_TEXT.copies);
    }

    const node = change.id === null ? null : await this.#lookup.node(change.id);

    if (node === null || node.type === FIGMA_NODE_TYPE.page || node.type === FIGMA_NODE_TYPE.document) {
      throw new WriteError(APPLY_TEXT.noLayer(change.id), APPLY_TEXT.noLayerHint);
    }

    const held = Reflect.get(TEXT_TAG, node.type) as string | undefined;
    const asked = Reflect.get(TEXT_TAG, NEW_LAYER_TYPE[change.tag] ?? "") as string | undefined;

    if (held !== asked) {
      const type = held ?? CAPABILITY_TEXT.type(node.type);

      throw new WriteError(APPLY_TEXT.notTag(change.id, type, change.tag), APPLY_TEXT.tagHint);
    }

    const page = load ? this.#lookup.pageOf(node) : null;

    if (page !== null) {
      await this.#pages.load(page);
    }

    return node;
  }

  /** The type a new layer is made as: its tag made in this release, in a parent that holds layers (a slot, a component). */
  creatable(change: ApplyChangeData, parent: TypedLayer): NodeType {
    const type = NEW_LAYER_TYPE[change.tag];

    if (change.copyOf !== undefined || change.source !== undefined) {
      throw new WriteError(APPLY_TEXT.copies);
    }

    if (type === undefined) {
      throw new WriteError(APPLY_TEXT.cannotMake(change.tag));
    }

    if (!this.#capabilities.has(parent, CAPABILITY.children)) {
      throw new WriteError(APPLY_TEXT.holdsNoLayers(CAPABILITY_TEXT.type(parent.type)));
    }

    if (type === FIGMA_NODE_TYPE.slot && parent.type !== FIGMA_NODE_TYPE.component) {
      throw new WriteError(APPLY_TEXT.slot, APPLY_TEXT.slotHint);
    }

    return type;
  }

  /** What the write refuses the change for its layer's type alone, the same on dry and real runs. */
  refusals(layer: TypedLayer, change: ApplyChangeData): Refusal[] {
    const refusals: Refusal[] = [];
    const written = new Set<keyof FigmaProps>([HIDDEN_KEY]);

    for (const step of this.#steps) {
      for (const key of step.keys) {
        written.add(key);
      }

      const { capability } = step;

      if (capability !== null && step.keys.some((key) => change.props[key] !== undefined)) {
        this.#attempt(refusals, step.keys, () => this.#capabilities.require(layer, capability));
      }
    }

    for (const key of Object.keys(change.props) as (keyof FigmaProps)[]) {
      if (!written.has(key)) {
        refusals.push({ error: new WriteError(APPLY_TEXT.notYet(change.sources[key] ?? key)), keys: [key] });
      }
    }

    return [...refusals, ...this.#textRefusals(layer, change)];
  }

  /** A text given to a layer that holds none; Span runs, written from a later release (the characters still are). */
  #textRefusals(layer: TypedLayer, { text }: ApplyChangeData): Refusal[] {
    if (text === undefined) {
      return [];
    }

    const refusals: Refusal[] = [];

    this.#attempt(refusals, [], () => this.#capabilities.require(layer, CAPABILITY.text), true);

    if (refusals.length === 0 && text.runs.length > 0) {
      refusals.push({ error: new WriteError(APPLY_TEXT.notYet(APPLY_TEXT.span)), keys: [] });
    }

    return refusals;
  }

  #attempt(
    refusals: Refusal[],
    keys: readonly (keyof FigmaProps)[],
    check: () => void,
    text = false,
  ): void {
    try {
      check();
    } catch (error) {
      refusals.push({ error, keys, ...(text ? { text } : {}) });
    }
  }
}

export const APPLY_CHECKS = new InjectionToken<ApplyChecks>("ApplyChecks");
