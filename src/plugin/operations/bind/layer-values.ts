import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { USED_TOKENS } from "@/plugin/adapters/figma/variables/used-tokens.ts";
import { BIND_SCAN } from "@/plugin/operations/bind/bind.constants.ts";
import {
  BIND_KIND,
  BIND_LAYOUT_FIELDS,
  BIND_NUMBER_FIELDS,
  BIND_PAINT_AT,
  BIND_STROKE_FIELDS,
} from "@/shared/ops/bind/bind.constants.ts";
import type { bindOp } from "@/shared/ops/bind/bind.manifest.ts";
import type { ScannedLayer } from "@/shared/ops/bind/bind.schema.ts";

type BindInput = zod.output<typeof bindOp.input>;

type ScannedPaint = ScannedLayer["paints"][number];

type ScannedText = ScannedLayer["texts"][number];

type PaintKey = typeof BIND_PAINT_AT.fills | typeof BIND_PAINT_AT.strokes;

type ScannedPaintAt = ScannedPaint["at"];

/**
 * One layer's raw values as Figma keeps them (P-164), for the server to match against the file's tokens: the solid
 * paints no style or variable gives (a text's runs where its fills differ), its number fields, its runs no text style
 * sets, and its effects when no style or variable gives them; with remap ids, only its uses of them. A mask's paints
 * are no colour to bind.
 */
@injectable()
export class LayerValues {
  readonly #used;

  constructor(used = inject(USED_TOKENS)) {
    this.#used = used;
  }

  /** The layer's values of the kinds asked, or its uses of the remap ids; null when it has none. */
  scan(layer: SceneNode, { kinds, remap }: BindInput): ScannedLayer | null {
    const raw = remap.length === 0;
    const numbers = raw && kinds.includes(BIND_KIND.number);
    const effects = raw && kinds.includes(BIND_KIND.effect) ? this.#effects(layer) : undefined;
    const stroked = numbers && "strokes" in layer && layer.strokes.some((paint) => paint.visible ?? true);
    const fields = [...BIND_NUMBER_FIELDS, ...(stroked ? BIND_STROKE_FIELDS : [])];
    const scanned: ScannedLayer = {
      id: layer.id,
      type: layer.type,
      modes: { ...layer.resolvedVariableModes },
      layout: numbers ? this.#strings(layer, BIND_LAYOUT_FIELDS) : {},
      numbers: numbers ? this.#numbers(layer, fields) : {},
      bound: numbers ? this.#bound(layer, fields) : [],
      stroked,
      paints: raw && kinds.includes(BIND_KIND.color) ? this.#paints(layer) : [],
      texts: raw && kinds.includes(BIND_KIND.text) ? this.#texts(layer) : [],
      ...(effects === undefined ? {} : { effects }),
      uses: raw ? {} : this.#uses(layer, remap),
    };

    return this.#worth(scanned) ? scanned : null;
  }

  #paints(layer: SceneNode): ScannedPaint[] {
    if ("isMask" in layer && layer.isMask) {
      return [];
    }

    const fills =
      layer.type === FIGMA_NODE_TYPE.text && typeof layer.fills === "symbol"
        ? this.#runs(layer)
        : this.#solids(layer, BIND_PAINT_AT.fills);

    return [...fills, ...this.#solids(layer, BIND_PAINT_AT.strokes)];
  }

  /** A layer's raw solids of one list, unless a style paints it (or says mixed); stylable when the list has one. */
  #solids(layer: SceneNode, at: PaintKey): ScannedPaint[] {
    const paints: unknown = Reflect.get(layer, at);

    if (!Array.isArray(paints) || Reflect.get(layer, BIND_SCAN.styleField[at]) !== "") {
      return [];
    }

    const list: readonly Paint[] = paints;

    return list.filter((paint) => this.#isRawSolid(paint)).map((paint) => this.#paint(at, paint, list.length === 1));
  }

  /** A text's runs of one raw solid colour where its runs differ, each with no fill style. */
  #runs(text: TextNode): ScannedPaint[] {
    return text.getStyledTextSegments([...BIND_SCAN.runFills]).flatMap(({ fills, fillStyleId }) => {
      const [paint] = fills;

      return fillStyleId === "" && fills.length === 1 && paint !== undefined && this.#isRawSolid(paint)
        ? [this.#paint(BIND_PAINT_AT.run, paint, true)]
        : [];
    });
  }

  #isRawSolid(paint: Paint): paint is SolidPaint {
    return paint.type === BIND_SCAN.solid && (paint.visible ?? true) && paint.boundVariables?.color === undefined;
  }

  #paint(
    at: ScannedPaintAt,
    { color, opacity }: SolidPaint,
    stylable: boolean,
  ): ScannedPaint {
    return { at, color: { r: color.r, g: color.g, b: color.b }, opacity: opacity ?? 1, stylable };
  }

  /** The fields the layer has as numbers (Figma's mixed, a symbol, is none). */
  #numbers(layer: SceneNode, fields: readonly string[]): Record<string, number> {
    return Object.fromEntries(
      fields.flatMap((field) => {
        const value: unknown = Reflect.get(layer, field);

        return typeof value === "number" ? [[field, value]] : [];
      }),
    );
  }

  #bound(layer: SceneNode, fields: readonly string[]): string[] {
    const bound = "boundVariables" in layer ? (layer.boundVariables ?? {}) : {};

    return fields.filter((field) => field in bound);
  }

  #strings(layer: SceneNode, fields: readonly string[]): Record<string, string> {
    return Object.fromEntries(
      fields.flatMap((field) => {
        const value: unknown = Reflect.get(layer, field);

        return typeof value === "string" ? [[field, value]] : [];
      }),
    );
  }

  /** A text's runs no text style sets, with the parts a text style sets. */
  #texts(layer: SceneNode): ScannedText[] {
    if (layer.type !== FIGMA_NODE_TYPE.text) {
      return [];
    }

    return layer
      .getStyledTextSegments([...BIND_SCAN.runText])
      .filter(({ textStyleId }) => textStyleId === "")
      .map(({ fontName, fontSize, lineHeight, letterSpacing, textCase, textDecoration }) => ({
        fontName: { family: fontName.family, style: fontName.style },
        fontSize,
        lineHeight: { ...lineHeight },
        letterSpacing: { ...letterSpacing },
        textCase,
        textDecoration,
      }));
  }

  /** The layer's effects when no effect style and no variable gives them. */
  #effects(layer: SceneNode): ScannedLayer["effects"] {
    if (
      !("effects" in layer) ||
      layer.effectStyleId !== "" ||
      layer.effects.length === 0 ||
      layer.effects.some((effect) => "boundVariables" in effect && Object.keys(effect.boundVariables ?? {}).length > 0)
    ) {
      return undefined;
    }

    // Plugin API effects are frozen objects: a JSON copy is what goes on the wire anyway.
    return JSON.parse(JSON.stringify(layer.effects));
  }

  /** How often the layer uses each of the ids: its style fields, bound variables and text runs. */
  #uses(layer: SceneNode, ids: readonly string[]): Record<string, number> {
    const { styles, variables } = this.#used.uses(layer);
    const all = [...styles, ...variables];

    return Object.fromEntries(
      ids.flatMap((id) => {
        const count = all.filter((each) => each === id).length;

        return count > 0 ? [[id, count]] : [];
      }),
    );
  }

  /** Whether the layer has anything to bind: a paint, a run, effects, a use, or a raw number past its default. */
  #worth({ paints, texts, effects, uses, numbers, bound }: ScannedLayer): boolean {
    return (
      paints.length > 0 ||
      texts.length > 0 ||
      effects !== undefined ||
      Object.keys(uses).length > 0 ||
      Object.entries(numbers).some(
        ([field, value]) => value > 0 && !(field === BIND_SCAN.opacity && value >= 1) && !bound.includes(field),
      )
    );
  }
}

export const LAYER_VALUES = new InjectionToken<LayerValues>("LayerValues");
