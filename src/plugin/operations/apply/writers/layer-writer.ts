import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import type { Capability, TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import type { Refusal } from "@/plugin/operations/apply/checks.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** One step of writing a layer: the props it writes, the capability its layer must have (null: every layer), how. */
export interface WriteStep {
  readonly keys: readonly (keyof FigmaProps)[];
  readonly capability: Capability | null;
  write(node: SceneNode, props: FigmaProps): void | Promise<void>;
  /** What the layer's type and the file's tokens refuse, found without writing (a dry run's check too). */
  check?(props: FigmaProps, layer: TypedLayer): void | Promise<void>;
}

/** The write steps in Figma's order (P-149): the layer's own layout before anything sized in it, then how it looks. */
export const WRITE_STEPS = new InjectionToken<WriteStep>("WriteSteps");

type Fail = (error: unknown, keys?: readonly (keyof FigmaProps)[]) => void;

/**
 * Writes a change onto its layer in Figma's order (P-149): its steps, then its text, and hiding it last, since a layer
 * hidden inside an instance can drop out of the plugin API at once (FX-021). Each step on its own: one that fails
 * leaves the others, its error naming its attribute; what the checks refused is not written.
 */
@injectable()
export class LayerWriter {
  readonly #steps;
  readonly #factory;
  readonly #assign;

  constructor(
    steps = inject(WRITE_STEPS, { multi: true }),
    factory = inject(LAYER_FACTORY),
    assign = inject(ASSIGN),
  ) {
    this.#steps = steps;
    this.#factory = factory;
    this.#assign = assign;
  }

  /** Whether a step, the text or hiding went in. */
  async write(
    node: SceneNode,
    change: ApplyChangeData,
    refusals: readonly Refusal[],
    fail: Fail,
  ): Promise<boolean> {
    const refused = new Set(refusals.flatMap(({ keys }) => keys));
    let wrote = false;

    for (const step of this.#steps) {
      if (step.keys.some((key) => change.props[key] !== undefined && !refused.has(key))) {
        wrote =
          (await this.#attempt(
            () => step.write(node, change.props),
            (error) => fail(error, step.keys),
          )) || wrote;
      }
    }

    if (change.text !== undefined && !refusals.some(({ text }) => text ?? false)) {
      const { characters } = change.text;

      wrote = (await this.#attempt(() => this.#characters(node as TextNode, characters), fail)) || wrote;
    }

    const { visible } = change.props;

    if (visible !== undefined) {
      wrote = (await this.#attempt(() => this.#assign.set(node, { visible }), fail)) || wrote;
    }

    return wrote;
  }

  /**
   * What the steps' own checks refuse (a token the file lacks, a weight per side on a layer without sides), the same
   * on dry and real runs; a step already refused is not checked again.
   */
  async checks(
    change: ApplyChangeData,
    layer: TypedLayer,
    refusals: readonly Refusal[],
  ): Promise<Refusal[]> {
    const refused = new Set(refusals.flatMap(({ keys }) => keys));
    const found: Refusal[] = [];

    for (const step of this.#steps) {
      if (step.check !== undefined && step.keys.some((key) => change.props[key] !== undefined && !refused.has(key))) {
        try {
          await step.check(change.props, layer);
        } catch (error) {
          found.push({ error, keys: step.keys });
        }
      }
    }

    return found;
  }

  /** New characters, the text's fonts loaded first; the same characters are not set again (P-080). */
  async #characters(node: TextNode, characters: string): Promise<void> {
    if (node.characters !== characters) {
      await this.#factory.loadFonts(node);
      this.#assign.set(node, { characters });
    }
  }

  async #attempt(write: () => unknown, fail: (error: unknown) => void): Promise<boolean> {
    try {
      await write();

      return true;
    } catch (error) {
      fail(error);

      return false;
    }
  }
}

export const LAYER_WRITER = new InjectionToken<LayerWriter>("LayerWriter");
