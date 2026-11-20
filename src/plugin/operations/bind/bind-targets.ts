import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PAINTS } from "@/plugin/adapters/figma/paints.ts";
import { LIBRARY_CATALOGUE } from "@/plugin/adapters/figma/variables/library-catalogue.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { BIND_SCAN, BIND_WRITE, BIND_WRITE_TEXT } from "@/plugin/operations/bind/bind.constants.ts";
import type { BindTarget } from "@/shared/ops/bind/bind.schema.ts";

/** What one writer call has looked up, each once: its layers, and its tokens' variables and styles (null: unreachable). */
export interface BindRun {
  readonly layers: Map<string, BaseNode>;
  readonly variables: Map<string, Variable | null>;
  readonly styles: Map<string, BaseStyle | null>;
}

/** A paint list to set: a layer's fills or strokes, or a text run's fills. */
export interface PaintSlot {
  read(): unknown;
  write(paints: readonly Paint[]): void;
}

/**
 * What the bind writer reaches for a plan (P-164, FX-015): its layers, its tokens' variables (a library's imported by
 * its key, which only a real run does) and styles, each looked up once a call since an offline lookup waits; a text's
 * fonts; a style set through its field's setter; and a paint bound to a variable, set so Figma keeps its opacity.
 */
@injectable()
export class BindTargets {
  readonly #lookup;
  readonly #library;
  readonly #factory;
  readonly #paints;

  constructor(
    lookup = inject(NODE_LOOKUP),
    library = inject(LIBRARY_CATALOGUE),
    factory = inject(LAYER_FACTORY),
    paints = inject(PAINTS),
  ) {
    this.#lookup = lookup;
    this.#library = library;
    this.#factory = factory;
    this.#paints = paints;
  }

  /** The layer by id, or NODE_NOT_FOUND. */
  async layer(id: string, run: BindRun): Promise<SceneNode> {
    const node = run.layers.get(id) ?? (await this.#lookup.existing(id));

    run.layers.set(id, node);

    if (node.type === FIGMA_NODE_TYPE.page || node.type === FIGMA_NODE_TYPE.document) {
      throw new WriteError(BIND_WRITE_TEXT.noLayer(id));
    }

    return node;
  }

  async variable({ token, id, key }: BindTarget, run: BindRun): Promise<Variable> {
    if (!run.variables.has(id)) {
      // A library's variable the file does not hold yet is imported by its key: a write, so the real run only.
      run.variables.set(
        id,
        key === undefined ? await this.#lookup.variable(id) : await this.#library.imported(key).catch(() => null),
      );
    }

    const variable = run.variables.get(id) ?? null;

    if (variable === null) {
      throw new WriteError(BIND_WRITE_TEXT.variable(token));
    }

    return variable;
  }

  async style({ token, id }: BindTarget, run: BindRun): Promise<BaseStyle> {
    if (!run.styles.has(id)) {
      run.styles.set(id, await this.#lookup.style(id));
    }

    const style = run.styles.get(id) ?? null;

    if (style === null) {
      throw new WriteError(BIND_WRITE_TEXT.style(token));
    }

    return style;
  }

  /** Loads the fonts a text uses, and a text style's, before its runs or its text style change. */
  async fonts(text: TextNode, style?: BaseStyle): Promise<void> {
    const own = style !== undefined && style.type === BIND_WRITE.textStyle ? [style.fontName] : [];

    for (const font of [...this.#factory.textFonts(text), ...own]) {
      await this.#factory.loadFont(font);
    }
  }

  /** Sets a style on the layer through its field's setter (setFillStyleIdAsync…). */
  async setStyle(
    layer: SceneNode,
    setter: string,
    id: string,
  ): Promise<void> {
    const method: unknown = Reflect.get(layer, setter);

    if (typeof method !== "function") {
      throw new WriteError(BIND_WRITE_TEXT.noField(setter));
    }

    await Reflect.apply(method, layer, [id]);
  }

  /**
   * A solid bound to the variable, its colour the variable's for the layer, the base's look kept, at the opacity
   * `opacity` gives for the variable's alpha.
   */
  async paint(
    base: Paint | undefined,
    variable: Variable,
    opacity: (alpha: number) => number,
    consumer: SceneNode,
  ): Promise<SolidPaint> {
    const fresh = await this.#paints.bound(variable, 1, consumer);
    const look = base !== undefined && base.type === BIND_SCAN.solid ? base : {};

    return { ...look, ...fresh, opacity: opacity(fresh.opacity ?? 1) };
  }

  /** Sets the paints, then the bound ones' opacities again where Figma gave them the variable's alpha (FX-046). */
  set(slot: PaintSlot, wanted: readonly Paint[]): void {
    slot.write(wanted);

    const live: unknown = slot.read();
    const again = Array.isArray(live) ? this.#paints.again(live, wanted) : null;

    if (again !== null) {
      slot.write(again);
    }
  }
}

export const BIND_TARGETS = new InjectionToken<BindTargets>("BindTargets");
