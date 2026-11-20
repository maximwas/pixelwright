import { InjectionToken, inject, injectable } from "@needle-di/core";
import { EFFECTS } from "@/plugin/adapters/figma/effects.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { BIND_SCAN, BIND_WRITE } from "@/plugin/operations/bind/bind.constants.ts";
import { BIND_TARGETS, type BindRun } from "@/plugin/operations/bind/bind-targets.ts";
import { BIND_PAINT_AT, BIND_SOURCE } from "@/shared/ops/bind/bind.constants.ts";
import type { BindTarget, PlannedRemap } from "@/shared/ops/bind/bind.schema.ts";

type PaintKey = typeof BIND_PAINT_AT.fills | typeof BIND_PAINT_AT.strokes;

/**
 * A layer's uses of one token rebound to another of its kind (K-029, 0.7.0's remap): a style in the layer's style
 * fields and its text's runs; a variable in its bound fields, its paints at the opacities they had, its effects, and
 * its text's runs (their fills where they differ, and fields such as a font size). Paints or effects a style gives
 * are the style's, and are left to it.
 */
@injectable()
export class RemapWriter {
  readonly #targets;
  readonly #effects;
  readonly #lists: ReadonlySet<string> = new Set(BIND_WRITE.listFields);

  constructor(targets = inject(BIND_TARGETS), effects = inject(EFFECTS)) {
    this.#targets = targets;
    this.#effects = effects;
  }

  async remap({ layer: id, from, to }: PlannedRemap, run: BindRun): Promise<void> {
    const layer = await this.#targets.layer(id, run);

    if (to.source === BIND_SOURCE.style) {
      await this.#styles(layer, from, to, run);
    } else {
      await this.#variables(layer, from, await this.#targets.variable(to, run));
    }
  }

  async #styles(
    layer: SceneNode,
    from: string,
    to: BindTarget,
    run: BindRun,
  ): Promise<void> {
    for (const [field, setter] of Object.entries(BIND_WRITE.styleSetters)) {
      if (Reflect.get(layer, field) === from) {
        if (layer.type === FIGMA_NODE_TYPE.text && setter === BIND_WRITE.styleSetters.textStyleId) {
          await this.#targets.fonts(layer, await this.#targets.style(to, run));
        }

        await this.#targets.setStyle(layer, setter, to.id);
      }
    }

    if (layer.type === FIGMA_NODE_TYPE.text) {
      await this.#runStyles(layer, from, to, run);
    }
  }

  /** A text's runs set to the from style, where its own style fields say mixed. */
  async #runStyles(
    text: TextNode,
    from: string,
    to: BindTarget,
    run: BindRun,
  ): Promise<void> {
    if (typeof text.fillStyleId !== "symbol" && typeof text.textStyleId !== "symbol") {
      return;
    }

    const runs = text
      .getStyledTextSegments([...BIND_WRITE.runStyles])
      .filter(({ fillStyleId, textStyleId }) => fillStyleId === from || textStyleId === from);

    if (runs.length === 0) {
      return;
    }

    await this.#targets.fonts(text, await this.#targets.style(to, run));

    for (const { start, end, fillStyleId } of runs) {
      await (fillStyleId === from
        ? text.setRangeFillStyleIdAsync(start, end, to.id)
        : text.setRangeTextStyleIdAsync(start, end, to.id));
    }
  }

  async #variables(
    layer: SceneNode,
    from: string,
    to: Variable,
  ): Promise<void> {
    const bound = "boundVariables" in layer ? (layer.boundVariables ?? {}) : {};

    for (const [field, alias] of Object.entries(bound)) {
      // A text's own fields (a font size) hold a list, one per run: its runs rebind them.
      if (!this.#lists.has(field) && this.#isAlias(alias, from)) {
        layer.setBoundVariable(field as VariableBindableNodeField, to);
      }
    }

    await this.#paints(layer, BIND_PAINT_AT.fills, from, to);
    await this.#paints(layer, BIND_PAINT_AT.strokes, from, to);
    this.#effectsOf(layer, from, to);

    if (layer.type === FIGMA_NODE_TYPE.text) {
      await this.#runVariables(layer, from, to);
    }
  }

  /** A layer's paints bound to the from variable, bound to the to one at the opacities they had. */
  async #paints(
    layer: SceneNode,
    at: PaintKey,
    from: string,
    to: Variable,
  ): Promise<void> {
    const live: unknown = Reflect.get(layer, at);

    // A list a style gives is the style's; a text's fills that differ by run are its runs'.
    if (!Array.isArray(live) || Reflect.get(layer, BIND_SCAN.styleField[at]) !== "") {
      return;
    }

    const paints: readonly Paint[] = live;

    if (paints.some((paint) => this.#boundTo(paint, from))) {
      const wanted = await this.#rebound(paints, from, to, layer);

      this.#targets.set(
        { read: () => Reflect.get(layer, at), write: (list) => Reflect.set(layer, at, [...list]) },
        wanted,
      );
    }
  }

  /** A text's runs whose fills (where they differ) or fields are bound to the from variable, bound to the to one. */
  async #runVariables(
    text: TextNode,
    from: string,
    to: Variable,
  ): Promise<void> {
    const mixed = typeof text.fills === "symbol";
    const runs = text
      .getStyledTextSegments([...BIND_WRITE.runVariables])
      .filter(
        (segment) =>
          (mixed && segment.fills.some((paint) => this.#boundTo(paint, from))) ||
          this.#runFields(segment, from).length > 0,
      );

    if (runs.length > 0) {
      await this.#targets.fonts(text);
    }

    for (const segment of runs) {
      const { start, end } = segment;

      if (mixed) {
        this.#targets.set(
          { read: () => text.getRangeFills(start, end), write: (list) => text.setRangeFills(start, end, [...list]) },
          await this.#rebound(segment.fills, from, to, text),
        );
      }

      for (const field of this.#runFields(segment, from)) {
        text.setRangeBoundVariable(start, end, field, to);
      }
    }
  }

  async #rebound(
    paints: readonly Paint[],
    from: string,
    to: Variable,
    layer: SceneNode,
  ): Promise<Paint[]> {
    const wanted: Paint[] = [];

    for (const paint of paints) {
      wanted.push(
        this.#boundTo(paint, from) ? await this.#targets.paint(paint, to, () => paint.opacity ?? 1, layer) : paint,
      );
    }

    return wanted;
  }

  /** A layer's effects with fields bound to the from variable, bound to the to one; a style's effects are its own. */
  #effectsOf(
    layer: SceneNode,
    from: string,
    to: Variable,
  ): void {
    if (
      !("effects" in layer) ||
      layer.effectStyleId !== "" ||
      !layer.effects.some((effect) => this.#effectFields(effect, from).length > 0)
    ) {
      return;
    }

    layer.effects = layer.effects.map((effect) =>
      this.#effectFields(effect, from).reduce((each, field) => this.#effects.rebound(each, field, to), effect),
    );
  }

  #effectFields(effect: Effect, from: string): VariableBindableEffectField[] {
    const bound = "boundVariables" in effect ? (effect.boundVariables ?? {}) : {};

    return Object.entries(bound).flatMap(([field, alias]) =>
      this.#isAlias(alias, from) ? [field as VariableBindableEffectField] : [],
    );
  }

  #runFields(segment: Pick<StyledTextSegment, "boundVariables">, from: string): VariableBindableTextField[] {
    return Object.entries(segment.boundVariables ?? {}).flatMap(([field, alias]) =>
      this.#isAlias(alias, from) ? [field as VariableBindableTextField] : [],
    );
  }

  #boundTo(paint: Paint, from: string): paint is SolidPaint {
    return paint.type === BIND_SCAN.solid && paint.boundVariables?.color?.id === from;
  }

  /** Whether a bound value is an alias to the variable; a list of them (a text's runs, paints) is not. */
  #isAlias(value: unknown, from: string): boolean {
    return typeof value === "object" && value !== null && "id" in value && value.id === from;
  }
}

export const REMAP_WRITER = new InjectionToken<RemapWriter>("RemapWriter");
