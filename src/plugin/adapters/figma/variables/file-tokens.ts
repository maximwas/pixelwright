import { InjectionToken, inject, injectable } from "@needle-di/core";
import { REFERENCES } from "@/plugin/adapters/figma/layer-read/references.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { USED_TOKENS } from "@/plugin/adapters/figma/variables/used-tokens.ts";
import type { RawCollection, RawTokens, RawVariable } from "@/shared/ops/variables/variables.schema.ts";

/** What a read of the tokens takes: the layers' too (used), under a layer or page (within) or on the current page. */
interface Asked {
  readonly used: boolean;
  readonly within?: string;
}

/**
 * The file's tokens as Figma keeps them (P-098): every local collection with its modes and every variable's value per
 * mode, aliases kept; the file's own paint, text and effect styles; with `used`, the styles and variables the layers
 * under `within` (or on the current page) use, a team library's among them; and in turn every variable an alias points
 * at, so each var() written is defined. Same-named styles are numbered as design_read numbers them (D-29). No style's
 * CSS is asked of Figma: core draws gradients from the paints (C-022, D-20).
 */
@injectable()
export class FileTokens {
  readonly #lookup;
  readonly #references;
  readonly #used;

  constructor(
    lookup = inject(NODE_LOOKUP),
    references = inject(REFERENCES),
    used = inject(USED_TOKENS),
  ) {
    this.#lookup = lookup;
    this.#references = references;
    this.#used = used;
  }

  async read({ used, within }: Asked, deadline: number): Promise<RawTokens> {
    const root = used ? await this.#root(within) : null;
    const found = root === null ? { styles: [], variables: [] } : this.#used.under(root, deadline);
    const raw: RawTokens = {
      collections: (await figma.variables.getLocalVariableCollectionsAsync()).map((each) => this.#collection(each)),
      variables: (await figma.variables.getLocalVariablesAsync()).map((each) => this.#variable(each)),
      external: {},
      styles: await this.#styles(found.styles, root ?? figma.currentPage),
      colorProfile: figma.root.documentColorProfile,
    };
    const values = [
      ...raw.variables.map((variable) => variable.valuesByMode),
      ...raw.styles.map((style) => style.effects),
    ];

    await this.#addVariables(raw, [...this.#used.aliases(values), ...found.variables]);

    return raw;
  }

  /** The layer or page whose used tokens to take, its page loaded. */
  async #root(within: string | undefined): Promise<BaseNode> {
    const root = within === undefined ? figma.currentPage : await this.#lookup.existing(within);

    await this.#lookup.pageOf(root)?.loadAsync();

    return root;
  }

  /** The file's own styles, then the used ones it lacks, numbered among the file's and the page's (D-29). */
  async #styles(used: readonly string[], node: BaseNode): Promise<RawTokens["styles"]> {
    const own = [
      ...(await figma.getLocalPaintStylesAsync()),
      ...(await figma.getLocalTextStylesAsync()),
      ...(await figma.getLocalEffectStylesAsync()),
    ];

    this.#references.start();

    const styles = await this.#references.styles(new Set([...own.map(({ id }) => id), ...used]), node);

    return Object.entries(styles).map(([id, style]) => ({ id, ...style }));
  }

  /** Adds the variables with these ids not held yet, and in turn every variable their values point at. */
  async #addVariables(raw: RawTokens, ids: readonly string[]): Promise<void> {
    const held = new Set(raw.variables.map(({ id }) => id));
    const collections = new Set(raw.collections.map(({ id }) => id));
    const queue = [...ids];

    for (const id of queue) {
      const variable = held.has(id) ? null : await this.#lookup.variable(id);

      held.add(id);

      if (variable !== null) {
        queue.push(...(await this.#add(raw, variable, collections)));
      }
    }
  }

  /** One variable with its collection, and the ids its values point at; one whose collection Figma cannot give is named only. */
  async #add(
    raw: RawTokens,
    variable: Variable,
    collections: Set<string>,
  ): Promise<string[]> {
    if (!collections.has(variable.variableCollectionId)) {
      const collection = await this.#lookup.collection(variable.variableCollectionId);

      if (collection === null) {
        raw.external[variable.id] = {
          name: variable.name,
          collection: "",
          resolvedType: variable.resolvedType,
          ...this.#codeSyntax(variable),
        };

        return [];
      }

      raw.collections.push(this.#collection(collection));
      collections.add(collection.id);
    }

    const entry = this.#variable(variable);

    raw.variables.push(entry);

    return this.#used.aliases(entry.valuesByMode);
  }

  #collection(collection: VariableCollection): RawCollection {
    return {
      id: collection.id,
      name: collection.name,
      remote: collection.remote,
      defaultModeId: collection.defaultModeId,
      modes: collection.modes.map(({ modeId, name }) => ({ modeId, name })),
    };
  }

  #variable(variable: Variable): RawVariable {
    return {
      id: variable.id,
      name: variable.name,
      collectionId: variable.variableCollectionId,
      resolvedType: variable.resolvedType,
      ...(variable.description === "" ? {} : { description: variable.description }),
      scopes: [...variable.scopes],
      ...this.#codeSyntax(variable),
      // Plugin API values are frozen objects: a JSON copy is what goes on the wire anyway.
      valuesByMode: JSON.parse(JSON.stringify(variable.valuesByMode)),
    };
  }

  #codeSyntax(variable: Variable): Pick<RawVariable, "codeSyntax"> {
    const entries = Object.entries(variable.codeSyntax);

    return entries.length === 0 ? {} : { codeSyntax: Object.fromEntries(entries) };
  }
}

export const FILE_TOKENS = new InjectionToken<FileTokens>("FileTokens");
