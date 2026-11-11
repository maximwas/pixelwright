import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { BLEND_CSS } from "@/core/css/groups/appearance/appearance.constants.ts";
import { FILL_NOTE, UNMAPPED_NOTE } from "@/core/css/groups/paint/paint.constants.ts";
import { PAINT_LIST } from "@/core/css/paints/paint-list.ts";
import { FIGMA_PAINT, PAINTS_VALUE, UNMAPPED_PAINT } from "@/core/css/paints/paints.constants.ts";
import { type Paint, SOLID_PAINT } from "@/core/css/paints/solid-paint.ts";
import { INSPECT_VALUE } from "@/core/inspect/inspect.constants.ts";
import type { InspectLayerView } from "@/core/inspect/inspect.schema.ts";
import type { Channels } from "@/core/kernel/color/color.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import type { InspectedLayer, InspectRaw } from "@/shared/ops/inspect/inspect.schema.ts";
import { READ_MODEL, READ_PROFILE, READ_VALUE } from "@/shared/read-model/read-model.constants.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type PaintsView = Pick<InspectLayerView, "blendMode" | "mixBlendMode" | "strokes" | "fills" | "bound">;

type Blend = Pick<InspectLayerView, "blendMode" | "mixBlendMode">;

type Variable = ReadModel["variables"][string];

/**
 * What paints a layer, for inspect (T-080, T-083, B-002, O-026): its blend mode and each fill's with CSS's
 * mix-blend-mode name; how its strokes paint; its fills as one CSS value (a style's own value, not its var()) with the
 * style and the variables behind them, and every visible fill's type, a video's too (D-23); the variables bound to its
 * own fields under the token design_read writes (TokenNames, one path). Colours in the file's space, as design_read's.
 */
@injectable()
export class InspectFills {
  readonly #paints;
  readonly #solid;
  readonly #names;

  constructor(
    paints = inject(PAINT_LIST),
    solid = inject(SOLID_PAINT),
    names = inject(TOKEN_NAMES),
  ) {
    this.#paints = paints;
    this.#solid = solid;
    this.#names = names;
  }

  read(layer: InspectedLayer, raw: InspectRaw): PaintsView {
    const model = this.#model(layer, raw);

    return {
      ...this.#blend(layer.blendMode),
      ...this.#strokes(layer, model),
      ...this.#fills(layer, model),
      ...this.#bound(layer, model),
    };
  }

  #blend(mode: string | undefined): Blend {
    if (mode === undefined || INSPECT_VALUE.plainBlends.some((plain) => plain === mode)) {
      return {};
    }

    const css = BLEND_CSS[mode];

    return { blendMode: mode, ...(css === undefined ? {} : { mixBlendMode: css }) };
  }

  #strokes(layer: InspectedLayer, model: ReadModel): Pick<InspectLayerView, "strokes"> {
    const { strokes = [], strokeWeight, dashPattern = [], strokesIncludedInLayout } = layer;

    if (strokes.length === 0) {
      return {};
    }

    const weights =
      strokeWeight === READ_VALUE.mixed
        ? {
          weights: {
            top: layer.strokeTopWeight ?? 0,
            right: layer.strokeRightWeight ?? 0,
            bottom: layer.strokeBottomWeight ?? 0,
            left: layer.strokeLeftWeight ?? 0,
          },
        }
        : {};

    return {
      strokes: {
        align: (layer.strokeAlign ?? INSPECT_VALUE.inside).toLowerCase(),
        ...(typeof strokeWeight === "number" ? { weight: strokeWeight } : weights),
        ...(dashPattern.length === 0 ? {} : { dashes: dashPattern }),
        colors: strokes.map((paint) => this.#colour(paint, model)),
        ...this.#strokeTokens(strokes, model),
        ...(strokesIncludedInLayout === undefined ? {} : { includedInLayout: strokesIncludedInLayout }),
      },
    };
  }

  /** The variables the visible strokes' colours are bound to, as a fill's tokens: a colour without one is raw. */
  #strokeTokens(strokes: readonly Paint[], model: ReadModel): { tokens?: Record<string, string> } {
    const tokens = this.#tokens(
      strokes.filter((paint) => paint.visible ?? true),
      model,
    );

    return tokens.length === 0 ? {} : { tokens: Object.fromEntries(tokens) };
  }

  /** A stroke's colour as its own value (faded by its opacity), any other paint by its type. */
  #colour(paint: Paint, model: ReadModel): string {
    return paint.type === FIGMA_PAINT.solid && paint.color !== undefined
      ? this.#solid.color(paint.color, undefined, paint.opacity ?? 1, model)
      : paint.type.toLowerCase();
  }

  #fills(layer: InspectedLayer, model: ReadModel): Pick<InspectLayerView, "fills"> {
    const { fills, fillStyleId } = layer;
    const visible = Array.isArray(fills) ? fills.filter((paint) => paint.visible ?? true) : [];

    if (visible.length === 0) {
      return {};
    }

    const css = this.#paints.css(visible, undefined, model, layer);
    const style = typeof fillStyleId === "string" ? model.styles[fillStyleId] : undefined;
    const tokens = this.#tokens(visible, model);

    return {
      fills: {
        css: css === null || css === UNMAPPED_PAINT ? this.#unmapped(visible) : css,
        ...(style === undefined ? {} : { style: { name: style.name, token: this.#names.style(style) } }),
        ...(tokens.length === 0 ? {} : { tokens: Object.fromEntries(tokens) }),
        paints: [...visible].reverse().map((paint) => ({ type: paint.type, ...this.#blend(paint.blendMode) })),
      },
    };
  }

  #unmapped(visible: readonly Paint[]): string {
    return visible.some((paint) => paint.type === FIGMA_PAINT.video)
      ? FILL_NOTE.video
      : UNMAPPED_NOTE[CSS_PROPERTY.background];
  }

  /** The colour variables the paints and their gradient stops are bound to: each token with its value. */
  #tokens(visible: readonly Paint[], model: ReadModel): (readonly [string, string])[] {
    return visible
      .flatMap((paint) => [paint.boundVariables, ...(paint.gradientStops ?? []).map((stop) => stop.boundVariables)])
      .flatMap((bound) => {
        const variable = this.#variable(bound, PAINTS_VALUE.boundColor, model);

        return variable === undefined
          ? []
          : [[this.#names.variable(variable), this.#value(variable.value, model)] as const];
      });
  }

  /** The variables bound to the layer's own fields (O-026): the token design_read's var() takes, and the value. */
  #bound(layer: InspectedLayer, model: ReadModel): Pick<InspectLayerView, "bound"> {
    const bound = layer.boundVariables ?? {};
    const entries = Object.keys(bound).flatMap((field) => {
      const variable = this.#variable(bound, field, model);

      return variable === undefined
        ? []
        : [[field, { token: this.#names.variable(variable), ...this.#plain(variable.value) }] as const];
    });

    return entries.length === 0 ? {} : { bound: Object.fromEntries(entries) };
  }

  #plain(value: unknown): { value?: number | string | boolean } {
    return typeof value === "number" || typeof value === "string" || typeof value === "boolean" ? { value } : {};
  }

  #value(value: unknown, model: ReadModel): string {
    return this.#isChannels(value) ? this.#solid.color(value, undefined, 1, model) : String(value);
  }

  #isChannels(value: unknown): value is Channels {
    return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
  }

  #variable(
    bound: unknown,
    key: string,
    model: ReadModel,
  ): Variable | undefined {
    const id = this.#names.alias(bound, key);

    return id === undefined ? undefined : model.variables[id];
  }

  /** The read model core's paint classes take: the op's styles, variables and colour profile around the layer. */
  #model(layer: InspectedLayer, { styles, variables, colorProfile }: InspectRaw): ReadModel {
    return {
      model: READ_MODEL.version,
      profile: READ_PROFILE.inspect,
      root: layer,
      styles,
      variables,
      ...(colorProfile === undefined ? {} : { colorProfile }),
    };
  }
}

export const INSPECT_FILLS = new InjectionToken<InspectFills>("InspectFills");
