import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import type { Capability, TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { LAYER_BOXES } from "@/plugin/adapters/figma/layer-boxes.ts";
import { LAYER_READ } from "@/plugin/adapters/figma/layer-read/layer-read.constants.ts";
import { ICON_TAG } from "@/plugin/operations/apply/apply.constants.ts";
import type { Refusal } from "@/plugin/operations/apply/checks.ts";
import { TEXT_WRITER } from "@/plugin/operations/apply/writers/text-writer.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** One step of writing a layer: the props it writes, the capability its layer must have (null: every layer), how. */
export interface WriteStep {
  readonly keys: readonly (keyof FigmaProps)[];
  readonly capability: Capability | null;
  write(node: SceneNode, props: FigmaProps): void | Promise<void>;
  /** What the layer's type and the file's tokens refuse, found without writing (a dry run's check too). */
  check?(props: FigmaProps, layer: TypedLayer): void | Promise<void>;
  /** What the place of a layer about to be made refuses, asked of its type and parent before it is made, on either run. */
  place?(props: FigmaProps, layer: TypedLayer): void;
}

/** The write steps in Figma's order (P-149): the layer's own layout before anything sized in it, then how it looks. */
export const WRITE_STEPS = new InjectionToken<WriteStep>("WriteSteps");

type Fail = (error: unknown, keys?: readonly (keyof FigmaProps)[]) => void;

/** A change's props once an Icon's size went into scaling it, and whether it did. */
interface Fitted {
  readonly props: FigmaProps;
  readonly scaled: boolean;
}

/**
 * Writes a change onto its layer in Figma's order (P-149): its steps, then its text (TextWriter), and hiding it last, since a layer
 * hidden inside an instance can drop out of the plugin API at once (FX-021). Each step on its own: one that fails
 * leaves the others, its error naming its attribute; what the checks refused is not written. An Icon's width or height
 * scales it whole first, its lines and corners too (T-134).
 */
@injectable()
export class LayerWriter {
  readonly #steps;
  readonly #text;
  readonly #assign;
  readonly #boxes;

  constructor(
    steps = inject(WRITE_STEPS, { multi: true }),
    text = inject(TEXT_WRITER),
    assign = inject(ASSIGN),
    boxes = inject(LAYER_BOXES),
  ) {
    this.#steps = steps;
    this.#text = text;
    this.#assign = assign;
    this.#boxes = boxes;
  }

  /** A call's start: its fonts found, and loaded on a real one (P-148). */
  async prepare(changes: readonly ApplyChangeData[], dry: boolean): Promise<void> {
    await this.#text.prepare(changes, dry);
  }

  /** Whether a step, the text or hiding went in. */
  async write(
    node: SceneNode,
    change: ApplyChangeData,
    refusals: readonly Refusal[],
    fail: Fail,
  ): Promise<boolean> {
    const refused = new Set(refusals.flatMap(({ keys }) => keys));
    const { props, scaled } = this.#fitted(node, change, fail);
    let wrote = scaled;

    for (const step of this.#steps) {
      if (step.keys.some((key) => props[key] !== undefined && !refused.has(key))) {
        wrote =
          (await this.#attempt(
            () => step.write(node, props),
            (error) => fail(error, step.keys),
          )) || wrote;
      }
    }

    if (!refusals.some(({ text }) => text ?? false)) {
      wrote = (await this.#text.write(node, change, refusals, fail)) || wrote;
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

    return [...found, ...(await this.#text.checks(change, layer, refused))];
  }

  /**
   * An Icon sized by scaling it whole (Figma's scale tool), by its width when given, else its height, the drawing keeping
   * its ratio; a new one is measured by its box, an existing one by the box design_read gives it (what it draws past its
   * box included); a size that reads the same scales nothing. Inside an instance Figma refuses it (FX-035).
   */
  #fitted(
    node: SceneNode,
    change: ApplyChangeData,
    fail: Fail,
  ): Fitted {
    const { width, height, ...rest } = change.props;

    if (change.tag !== ICON_TAG || (width === undefined && height === undefined)) {
      return { props: change.props, scaled: false };
    }

    const box = change.kind === APPLY_CHANGE_KIND.create ? (node as FrameNode) : this.#drawn(node);
    const [wanted, held] =
      typeof width === "number" ? [width, box.width] : typeof height === "number" ? [height, box.height] : [0, 0];

    try {
      const scaled = wanted > 0 && held > 0 && Math.round(wanted) !== Math.round(held);

      if (scaled) {
        (node as FrameNode).rescale(wanted / held);
      }

      return { props: rest, scaled };
    } catch (error) {
      fail(error, STEP_KEYS.size);

      return { props: rest, scaled: false };
    }
  }

  /** The box design_read gives an existing layer: the one it draws in when that reaches half a pixel past its own. */
  #drawn(node: SceneNode): { readonly width: number; readonly height: number } {
    const own = this.#boxes.layout(node) ?? (node as FrameNode);
    const drawn = this.#boxes.painted(node);
    const past = (one: number, other: number) => Math.abs(one - other) > LAYER_READ.drawnPastPx;

    return drawn !== null && (past(drawn.width, own.width) || past(drawn.height, own.height)) ? drawn : own;
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
