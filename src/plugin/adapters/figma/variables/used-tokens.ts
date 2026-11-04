import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { REFERENCE_FIELD } from "@/plugin/adapters/figma/layer-read/layer-read.constants.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { STYLE_USES, TEXT_RUN } from "@/plugin/adapters/figma/variables/variables.constants.ts";
import { USAGE_WITHIN } from "@/shared/ops/usage/usage.constants.ts";

/** The ids of the styles and variables layers use. */
export interface UsedIds {
  readonly styles: string[];
  readonly variables: string[];
}

/**
 * What layers use (P-096, P-098): the paint, text and effect styles they name and the variables their fields, paints
 * and effects are bound to, and where a text's own fields say mixed, its runs' (O-024); under a layer or page as far
 * as the op's deadline lets the walk go (P-075), or where one layer uses a given style or variable (T-106).
 */
@injectable()
export class UsedTokens {
  readonly #walk;
  readonly #lookup;

  constructor(walk = inject(LAYER_WALK), lookup = inject(NODE_LOOKUP)) {
    this.#walk = walk;
    this.#lookup = lookup;
  }

  under(root: BaseNode, deadline: number): UsedIds {
    const { kept } = this.#walk.until(this.#walk.layers(this.#layersOf(root)), deadline, {
      accepts: (layer) => this.#styleIds(layer).length > 0 || this.#bound(layer) !== undefined || this.#mixed(layer),
      enough: Number.POSITIVE_INFINITY,
    });
    const used = kept.map((layer) => this.#uses(layer));

    return {
      styles: [...new Set(used.flatMap(({ styles }) => styles))],
      variables: [...new Set(used.flatMap(({ variables }) => variables))],
    };
  }

  /**
   * The layers a usage scan starts from (T-106): `within`'s, its page loaded; every page's with "file", the current
   * page first; else the current page's.
   */
  async roots(within: string | undefined): Promise<readonly SceneNode[]> {
    if (within === USAGE_WITHIN.file) {
      await figma.loadAllPagesAsync();

      return [figma.currentPage, ...figma.root.children.filter((page) => page !== figma.currentPage)].flatMap(
        (page) => page.children,
      );
    }

    const root = within === undefined ? figma.currentPage : await this.#lookup.existing(within);

    await this.#lookup.pageOf(root)?.loadAsync();

    return this.#layersOf(root);
  }

  /**
   * Where a layer uses the style or variable (T-106): the style field naming it (fill, stroke, effect, text) or the
   * bound field, else a text run when only a run has it (O-024); null when the layer does not use it.
   */
  where(
    layer: SceneNode,
    id: string,
    variable: boolean,
  ): string | null {
    const field = variable
      ? Object.entries(this.#bound(layer) ?? {}).find(([, value]) => this.aliases(value).includes(id))?.[0]
      : STYLE_USES.find(([key]) => Reflect.get(layer, key) === id)?.[1];

    if (field !== undefined) {
      return field;
    }

    const runs = this.#runs(layer);

    return (variable ? runs.variables : runs.styles).includes(id) ? TEXT_RUN.use : null;
  }

  /** The variable ids values point at: each alias `{ type: "VARIABLE_ALIAS", id }` anywhere in them, depth first. */
  aliases(values: unknown): string[] {
    if (Array.isArray(values)) {
      return values.flatMap((value) => this.aliases(value));
    }

    if (typeof values !== "object" || values === null) {
      return [];
    }

    if ("type" in values && values.type === REFERENCE_FIELD.alias && "id" in values && typeof values.id === "string") {
      return [values.id];
    }

    return Object.values(values).flatMap((value) => this.aliases(value));
  }

  /** The layers under a page, or the layer itself; none for the document. */
  #layersOf(root: BaseNode): readonly SceneNode[] {
    return root.type === FIGMA_NODE_TYPE.page ? root.children : root.type === FIGMA_NODE_TYPE.document ? [] : [root];
  }

  /** What one layer uses: its own style fields and bound variables, and its text runs'. */
  #uses(layer: SceneNode): UsedIds {
    const runs = this.#runs(layer);

    return {
      styles: [...this.#styleIds(layer), ...runs.styles],
      variables: [...this.aliases(this.#bound(layer)), ...runs.variables],
    };
  }

  #styleIds(layer: SceneNode): string[] {
    return STYLE_USES.flatMap(([field]) => {
      const id: unknown = Reflect.get(layer, field);

      return typeof id === "string" && id !== "" ? [id] : [];
    });
  }

  /** The variables bound to the layer's fields, paints and effects; none when it has no binding. */
  #bound(layer: SceneNode): object | undefined {
    const bound = "boundVariables" in layer ? layer.boundVariables : undefined;

    return bound === undefined || Object.keys(bound).length === 0 ? undefined : bound;
  }

  /**
   * A text's runs' styles and the variables their fills and fields are bound to, read only where the text says mixed
   * (O-024): otherwise a style or variable one run alone uses is missed.
   */
  #runs(layer: SceneNode): UsedIds {
    if (layer.type !== FIGMA_NODE_TYPE.text || !this.#mixed(layer)) {
      return { styles: [], variables: [] };
    }

    const runs = layer.getStyledTextSegments([...TEXT_RUN.fields]);

    return {
      styles: runs.flatMap(({ fillStyleId, textStyleId }) => [fillStyleId, textStyleId]).filter((id) => id !== ""),
      variables: this.aliases(runs.map(({ fills, boundVariables }) => [fills, boundVariables])),
    };
  }

  /** A text whose style ids or fills differ between its runs: Figma gives those fields figma.mixed, a symbol. */
  #mixed(layer: SceneNode): boolean {
    return (
      layer.type === FIGMA_NODE_TYPE.text &&
      [layer.fillStyleId, layer.textStyleId, layer.fills].some((value) => typeof value === "symbol")
    );
  }
}

export const USED_TOKENS = new InjectionToken<UsedTokens>("UsedTokens");
