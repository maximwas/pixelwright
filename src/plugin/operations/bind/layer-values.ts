import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
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
import type { BindScan, ScannedLayer } from "@/shared/ops/bind/bind.schema.ts";

type BindInput = zod.output<typeof bindOp.input>;

type ScannedPaint = ScannedLayer["paints"][number];

type ScannedText = ScannedLayer["texts"][number];

type PaintKey = typeof BIND_PAINT_AT.fills | typeof BIND_PAINT_AT.strokes;

type ScannedPaintAt = ScannedPaint["at"];

/** A layer's values before its modes are read: only a layer worth binding pays for resolvedVariableModes. */
type Unmoded = Omit<ScannedLayer, "modes">;

/**
 * One layer's raw values as Figma keeps them (P-164), for the server to match against the file's tokens: the solid
 * paints no style or variable gives (a text's runs where its fills differ), its number fields, its runs no text style
 * sets, and its effects when no style or variable gives them, each where it sits; the variables Figma infers for its
 * paints and numbers (inferredVariables); with remap ids, only its uses of them. A mask's paints are no colour to bind.
 */
@injectable()
export class LayerValues {
  readonly #used;
  readonly #lookup;

  constructor(used = inject(USED_TOKENS), lookup = inject(NODE_LOOKUP)) {
    this.#used = used;
    this.#lookup = lookup;
  }

  /** The layer's values of the kinds asked, or its uses of the remap ids; null when it has none. */
  scan(layer: SceneNode, { kinds, remap }: BindInput): ScannedLayer | null {
    const raw = remap.length === 0;
    const numbers = raw && kinds.includes(BIND_KIND.number);
    const effects = raw && kinds.includes(BIND_KIND.effect) ? this.#effects(layer) : undefined;
    const stroked = numbers && "strokes" in layer && layer.strokes.some((paint) => paint.visible ?? true);
    const fields = [...BIND_NUMBER_FIELDS, ...(stroked ? BIND_STROKE_FIELDS : [])];
    const scanned: Unmoded = {
      id: layer.id,
      type: layer.type,
      layout: numbers ? this.#strings(layer, BIND_LAYOUT_FIELDS) : {},
      numbers: numbers ? this.#numbers(layer, fields) : {},
      bound: numbers ? this.#bound(layer, fields) : [],
      stroked,
      paints: raw && kinds.includes(BIND_KIND.color) ? this.#paints(layer) : [],
      texts: raw && kinds.includes(BIND_KIND.text) ? this.#texts(layer) : [],
      ...(effects === undefined ? {} : { effects }),
      uses: raw ? {} : this.#uses(layer, remap),
      ...this.#missingFont(layer),
    };

    return this.#worth(scanned)
      ? { ...scanned, modes: { ...layer.resolvedVariableModes }, ...this.#inferred(layer, scanned) }
      : null;
  }

  /**
   * The library variables Figma inferred for the layers that the file does not hold (P-164), by id: what their tokens
   * are named, their type and scopes, and the key the writer imports one by. The file's own are in its tokens.
   */
  async variables(layers: readonly ScannedLayer[]): Promise<BindScan["variables"]> {
    const ids = new Set(
      layers.flatMap(({ paints, inferred }) => [
        ...paints.flatMap((paint) => paint.inferred ?? []),
        ...Object.values(inferred ?? {}).flat(),
      ]),
    );
    const variables: BindScan["variables"] = {};

    for (const id of ids) {
      const variable = await this.#lookup.variable(id);

      if (variable !== null && variable.remote) {
        const { name, resolvedType, scopes, key, codeSyntax } = variable;
        const named = Object.keys(codeSyntax).length === 0 ? {} : { codeSyntax: { ...codeSyntax } };

        variables[id] = { name, resolvedType, scopes: [...scopes], key, ...named };
      }
    }

    return variables;
  }

  /** The variables Figma infers for the layer's raw paints and number fields (inferredVariables), by paint and field. */
  #inferred(layer: SceneNode, { paints, numbers, bound }: Unmoded): Pick<ScannedLayer, "paints" | "inferred"> {
    const raw = Object.keys(numbers).filter((field) => this.#isRaw(field, numbers[field] ?? 0, bound));
    // Figma works the inference out when it is read: a layer with no raw paint or number is spared it.
    const inferred =
      "inferredVariables" in layer && (paints.length > 0 || raw.length > 0) ? layer.inferredVariables : undefined;

    if (inferred === undefined) {
      return { paints };
    }

    const fields = Object.fromEntries(
      raw.flatMap((field) => {
        const ids = this.#used.aliases(Reflect.get(inferred, field));

        return ids.length === 0 ? [] : [[field, ids]];
      }),
    );
    const offered = paints.map((paint) => {
      const ids = paint.at === BIND_PAINT_AT.run ? [] : this.#used.aliases(inferred[paint.at]?.[paint.index]);

      return ids.length === 0 ? paint : { ...paint, inferred: ids };
    });

    return { paints: offered, ...(Object.keys(fields).length === 0 ? {} : { inferred: fields }) };
  }

  /** A text whose fonts Figma lacks: binding its text style or a run's colour would load them. */
  #missingFont(layer: SceneNode): Pick<ScannedLayer, "missingFont"> {
    return layer.type === FIGMA_NODE_TYPE.text && layer.hasMissingFont ? { missingFont: true } : {};
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

    return list.flatMap((paint, index) =>
      this.#isRawSolid(paint) ? [this.#paint(at, index, paint, list.length === 1)] : [],
    );
  }

  /** A text's runs of one raw solid colour where its runs differ, each with no fill style. */
  #runs(text: TextNode): ScannedPaint[] {
    return text.getStyledTextSegments([...BIND_SCAN.runFills]).flatMap(({ fills, fillStyleId, start, end }) => {
      const [paint] = fills;

      return fillStyleId === "" && fills.length === 1 && paint !== undefined && this.#isRawSolid(paint)
        ? [{ ...this.#paint(BIND_PAINT_AT.run, 0, paint, true), range: { start, end } }]
        : [];
    });
  }

  #isRawSolid(paint: Paint): paint is SolidPaint {
    return paint.type === BIND_SCAN.solid && (paint.visible ?? true) && paint.boundVariables?.color === undefined;
  }

  /** A raw paint at its index in its list (a run's one paint at 0). */
  #paint(
    at: ScannedPaintAt,
    index: number,
    { color, opacity }: SolidPaint,
    stylable: boolean,
  ): ScannedPaint {
    return { at, index, color: { r: color.r, g: color.g, b: color.b }, opacity: opacity ?? 1, stylable };
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
      .map(({ start, end, fontName, fontSize, lineHeight, letterSpacing, textCase, textDecoration }) => ({
        range: { start, end },
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
  #worth({ paints, texts, effects, uses, numbers, bound }: Unmoded): boolean {
    return (
      paints.length > 0 ||
      texts.length > 0 ||
      effects !== undefined ||
      Object.keys(uses).length > 0 ||
      Object.entries(numbers).some(([field, value]) => this.#isRaw(field, value, bound))
    );
  }

  /** A raw number past its default: not zero nor a full opacity, and bound to no variable. */
  #isRaw(
    field: string,
    value: number,
    bound: readonly string[],
  ): boolean {
    return value > 0 && !(field === BIND_SCAN.opacity && value >= 1) && !bound.includes(field);
  }
}

export const LAYER_VALUES = new InjectionToken<LayerValues>("LayerValues");
