import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { BIND_SCAN, BIND_WRITE, BIND_WRITE_TEXT } from "@/plugin/operations/bind/bind.constants.ts";
import { BIND_TARGETS, type BindRun } from "@/plugin/operations/bind/bind-targets.ts";
import { BIND_KIND, BIND_PAINT_AT, BIND_SOURCE } from "@/shared/ops/bind/bind.constants.ts";
import type { PlannedBind } from "@/shared/ops/bind/bind.schema.ts";

type Planned<Kind extends PlannedBind["kind"]> = Extract<PlannedBind, { kind: Kind }>;

type ColorBind = Planned<typeof BIND_KIND.color>;

/**
 * One planned use bound where the scan found it (P-164, 0.7.0's bind writers): a colour to its paint style (the
 * layer's one paint, or a run's range) or to its colour variable at the opacity the plan keeps, a number's Figma fields
 * to the number variable (four corners or sides as one), a run to its text style once the fonts are loaded, the
 * effects to their effect style.
 */
@injectable()
export class UseBinder {
  readonly #targets;

  constructor(targets = inject(BIND_TARGETS)) {
    this.#targets = targets;
  }

  async bind(planned: PlannedBind, run: BindRun): Promise<void> {
    const layer = await this.#targets.layer(planned.layer, run);

    if (planned.kind === BIND_KIND.color) {
      await this.#color(layer, planned, run);
    } else if (planned.kind === BIND_KIND.number) {
      const variable = await this.#targets.variable(planned.target, run);

      for (const field of planned.fields) {
        layer.setBoundVariable(field as VariableBindableNodeField, variable);
      }
    } else if (planned.kind === BIND_KIND.text) {
      await this.#text(this.#textOf(layer), planned, run);
    } else {
      await this.#targets.setStyle(layer, BIND_WRITE.styleSetters.effectStyleId, planned.target.id);
    }
  }

  async #color(
    layer: SceneNode,
    planned: ColorBind,
    run: BindRun,
  ): Promise<void> {
    const { at, index, target } = planned;

    if (at === BIND_PAINT_AT.run) {
      await this.#runColor(this.#textOf(layer), planned, run);

      return;
    }

    if (target.source === BIND_SOURCE.style) {
      await this.#targets.setStyle(layer, BIND_WRITE.styleSetters[BIND_SCAN.styleField[at]], target.id);

      return;
    }

    const live: unknown = Reflect.get(layer, at);

    if (!Array.isArray(live)) {
      throw new WriteError(BIND_WRITE_TEXT.noField(at));
    }

    const paints: Paint[] = [...live];

    paints[index] = await this.#paint(paints[index], planned, layer, run);
    this.#targets.set(
      { read: () => Reflect.get(layer, at), write: (wanted) => Reflect.set(layer, at, [...wanted]) },
      paints,
    );
  }

  /** A run's colour: its paint style on the range, or a paint bound to the variable, with the text's fonts loaded. */
  async #runColor(
    text: TextNode,
    planned: ColorBind,
    run: BindRun,
  ): Promise<void> {
    const { start, end } = planned.range ?? { start: 0, end: text.characters.length };

    await this.#targets.fonts(text);

    if (planned.target.source === BIND_SOURCE.style) {
      await text.setRangeFillStyleIdAsync(start, end, planned.target.id);

      return;
    }

    const live = text.getRangeFills(start, end);
    const paint = await this.#paint(typeof live === "symbol" ? undefined : live[0], planned, text, run);

    this.#targets.set(
      { read: () => text.getRangeFills(start, end), write: (wanted) => text.setRangeFills(start, end, [...wanted]) },
      [paint],
    );
  }

  /** The paint bound to the target's variable: the paint's own opacity, laid over the token's alpha when snapped. */
  async #paint(
    base: Paint | undefined,
    { target, snapped, opacity }: ColorBind,
    layer: SceneNode,
    run: BindRun,
  ): Promise<SolidPaint> {
    const variable = await this.#targets.variable(target, run);

    return await this.#targets.paint(base, variable, (alpha) => (snapped ? alpha * opacity : opacity), layer);
  }

  async #text(
    text: TextNode,
    { range, target }: Planned<typeof BIND_KIND.text>,
    run: BindRun,
  ): Promise<void> {
    const style = await this.#targets.style(target, run);

    await this.#targets.fonts(text, style);
    await text.setRangeTextStyleIdAsync(range.start, range.end, style.id);
  }

  #textOf(layer: SceneNode): TextNode {
    if (layer.type !== FIGMA_NODE_TYPE.text) {
      throw new WriteError(BIND_WRITE_TEXT.noField(BIND_WRITE.text));
    }

    return layer;
  }
}

export const USE_BINDER = new InjectionToken<UseBinder>("UseBinder");
