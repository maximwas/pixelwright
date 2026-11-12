import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { USED_TOKENS } from "@/plugin/adapters/figma/variables/used-tokens.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { USAGE_PAINT } from "@/plugin/operations/usage/usage.constants.ts";
import { RAW_PROPERTY, USAGE } from "@/shared/ops/usage/usage.constants.ts";
import type { usageOp } from "@/shared/ops/usage/usage.manifest.ts";

type UsageInput = zod.output<typeof usageOp.input>;

type UsageOutput = zod.output<typeof usageOp.output>;

type UsageLayer = UsageOutput["layers"][number];

type Channels = NonNullable<UsageLayer["color"]>;

/** Where a layer uses a raw colour, and the colour. */
type RawUse = readonly [property: string, color: Channels];

/**
 * The usage op (P-126, T-106): the layers under `within` (a layer or page, every page with "file", else the current
 * page) that use the style or variable, and where, a mixed text's runs read too (O-024); with `raw`, every use of a
 * colour bound to no style and no variable (fills, strokes, a mixed text's runs, effects; a gradient's stops as its
 * paint's; invisible paints skipped). The caller's budget bounds the scan (D-48): when it is spent the op answers with
 * what it found, cut. One entry past USAGE.maxLayers ends the scan: more says the rest exist.
 */
@injectable()
export class UsageOperation extends Operation<UsageInput, UsageOutput> {
  readonly #walk;
  readonly #used;

  constructor(
    report = inject(OP_REPORT),
    walk = inject(LAYER_WALK),
    used = inject(USED_TOKENS),
  ) {
    super(report);
    this.#walk = walk;
    this.#used = used;
  }

  protected async execute(input: UsageInput): Promise<UsageOutput> {
    const deadline = this.#walk.deadline(input.budgetMs);
    const layers: UsageLayer[] = [];
    const { cut } = this.#walk.until(this.#walk.layers(await this.#used.roots(input.within)), deadline, {
      accepts: (layer) => {
        const found = this.#uses(layer, input);

        layers.push(...found);

        return found.length > 0;
      },
      enough: USAGE.maxLayers + 1,
    });

    return { layers: layers.slice(0, USAGE.maxLayers), more: cut || layers.length > USAGE.maxLayers, cut };
  }

  /** What one layer gives: where it uses the style or variable, or with raw each raw colour it uses. */
  #uses(layer: SceneNode, { id = "", variable = false, raw }: UsageInput): UsageLayer[] {
    if (raw ?? false) {
      return [...this.#rawFills(layer), ...this.#rawStrokes(layer), ...this.#rawEffects(layer)].map(
        ([property, color]) => this.#entry(layer, property, color),
      );
    }

    const property = this.#used.where(layer, id, variable);

    return property === null ? [] : [this.#entry(layer, property)];
  }

  #entry(
    layer: SceneNode,
    property: string,
    color?: Channels,
  ): UsageLayer {
    return {
      id: layer.id,
      name: layer.name,
      type: layer.type,
      property,
      ...(this.#walk.hidden(layer) ? { hidden: true as const } : {}),
      ...(color === undefined ? {} : { color }),
    };
  }

  /** A layer's fills no style paints; a text whose fills or fill styles differ by run, each unstyled run's (O-024). */
  #rawFills(layer: SceneNode): RawUse[] {
    if (
      layer.type === FIGMA_NODE_TYPE.text &&
      (typeof layer.fills === "symbol" || typeof layer.fillStyleId === "symbol")
    ) {
      return layer
        .getStyledTextSegments([...USAGE_PAINT.runFields])
        .flatMap(({ fills, fillStyleId }) => (fillStyleId === "" ? this.#raw(RAW_PROPERTY.text, fills) : []));
    }

    return "fills" in layer && !this.#styled(layer.fillStyleId) && Array.isArray(layer.fills)
      ? this.#raw(RAW_PROPERTY.fills, layer.fills)
      : [];
  }

  #rawStrokes(layer: SceneNode): RawUse[] {
    return "strokes" in layer && !this.#styled(layer.strokeStyleId)
      ? this.#raw(RAW_PROPERTY.strokes, layer.strokes)
      : [];
  }

  /** The colours of a layer's visible shadows no effect style or variable gives. */
  #rawEffects(layer: SceneNode): RawUse[] {
    if (!("effects" in layer) || this.#styled(layer.effectStyleId)) {
      return [];
    }

    return layer.effects.flatMap((effect) =>
      effect.visible && "color" in effect && !("color" in (effect.boundVariables ?? {}))
        ? [[RAW_PROPERTY.effects, this.#channels(effect.color)] as const]
        : [],
    );
  }

  /** The visible paints' colours (opacity above 0) bound to no variable: a solid's, and each gradient stop's. */
  #raw(property: string, paints: readonly Paint[]): RawUse[] {
    return paints
      .filter((paint) => (paint.visible ?? true) && (paint.opacity ?? 1) > 0)
      .flatMap((paint) => {
        if (paint.type === USAGE_PAINT.solid) {
          return paint.boundVariables?.color === undefined ? [this.#channels(paint.color)] : [];
        }

        const stops = "gradientStops" in paint ? paint.gradientStops : [];

        return stops
          .filter((stop) => stop.boundVariables?.color === undefined)
          .map((stop) => this.#channels(stop.color));
      })
      .map((color) => [property, color] as const);
  }

  /** A style field naming a style (Figma's mixed, a symbol, is handled by the caller). */
  #styled(id: unknown): boolean {
    return typeof id === "string" && id !== "";
  }

  #channels({ r, g, b }: RGB): Channels {
    return { r, g, b };
  }
}
