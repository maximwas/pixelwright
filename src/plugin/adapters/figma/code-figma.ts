import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CODE_FIGMA_HIDDEN, CODE_FIGMA_TEXT, CODE_FONTS } from "@/plugin/adapters/figma/figma.constants.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";

/**
 * Figma as execute's code gets it (T-150): the Plugin API without clientStorage, ui, closePlugin and showUI (D-11),
 * Pixelwright's helpers
 * for pw (T-154), and each call run so that figma.skipInvisibleInstanceChildren is set back after it (FX-021) and what
 * it changed is one undo step (T-156).
 */
@injectable()
export class CodeFigma {
  readonly #lookup;
  readonly #hidden: ReadonlySet<PropertyKey> = new Set(CODE_FIGMA_HIDDEN);
  #api: PluginAPI | undefined;

  constructor(lookup = inject(NODE_LOOKUP)) {
    this.#lookup = lookup;
  }

  /**
   * The API the code is given: a proxy that hides clientStorage, ui, closePlugin and showUI, its methods bound to
   * Figma's own object.
   * shortcut: code can still reach the real one as globalThis.figma, and through it clientStorage (the pairing key, the
   * Allow edits flag), closePlugin and showUI; only a separate realm would close that.
   */
  api(): PluginAPI {
    // A blank target: Figma's methods are non-configurable, so a proxy over figma itself may not return them bound.
    this.#api ??= new Proxy(Object.create(null) as PluginAPI, {
      get: (_blank, key) => (this.#hidden.has(key) ? undefined : this.#bound(Reflect.get(figma, key))),
      set: (
        _blank,
        key,
        value,
      ) => Reflect.set(figma, key, value),
      has: (_blank, key) => !this.#hidden.has(key) && Reflect.has(figma, key),
    });

    return this.#api;
  }

  /** figma.mixed, which a returned value names as "mixed". */
  mixed(): symbol {
    return figma.mixed;
  }

  /** Pixelwright's helpers, put back on pw every call: a layer by id or an error, the fonts under a layer loaded. */
  helpers(): Readonly<Record<string, unknown>> {
    return {
      node: async (id: string) => await this.#node(id),
      fonts: async (layer: BaseNode) => await this.#fonts(layer),
    };
  }

  /** Runs one call's code: Figma's switch for hidden instance children set back after it, and one undo step. */
  async around<Value>(run: () => Promise<Value>): Promise<Value> {
    const skipInvisible = figma.skipInvisibleInstanceChildren;

    try {
      return await run();
    } finally {
      figma.skipInvisibleInstanceChildren = skipInvisible;
      figma.commitUndo();
    }
  }

  #bound(value: unknown): unknown {
    return typeof value === "function" ? value.bind(figma) : value;
  }

  async #node(id: string): Promise<BaseNode> {
    const node = await this.#lookup.node(id);

    if (node === null) {
      throw new Error(CODE_FIGMA_TEXT.noLayer(id));
    }

    return node;
  }

  /** Every font the texts under a layer use, mixed runs included, loaded before code changes them. */
  async #fonts(layer: BaseNode): Promise<void> {
    const texts =
      layer.type === CODE_FONTS.text
        ? [layer]
        : "findAllWithCriteria" in layer
          ? layer.findAllWithCriteria({ types: [CODE_FONTS.text] })
          : [];
    const fonts = new Map<string, FontName>();

    for (const text of texts) {
      for (const { fontName } of text.getStyledTextSegments([CODE_FONTS.fontName])) {
        fonts.set(CODE_FONTS.key(fontName), fontName);
      }
    }

    await Promise.all([...fonts.values()].map(async (font) => await figma.loadFontAsync(font)));
  }
}

export const CODE_FIGMA = new InjectionToken<CodeFigma>("CodeFigma");
