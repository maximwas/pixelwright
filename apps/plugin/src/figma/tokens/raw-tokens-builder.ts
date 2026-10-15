import { type RawTokens, unwrapVar } from "@pixelwright/core";
import { plain } from "../../utils/plain.ts";
import { colorProfile } from "../color-profile.ts";
import { pageOf } from "../nodes.ts";
import { localStyles, numbered, numberingStyles, styleOf } from "../styles.ts";
import { aliasesIn, loaded, usedUnder } from "../used-tokens.ts";

type RawCollection = RawTokens["collections"][number];
type RawVariable = RawTokens["variables"][number];
type RawStyle = RawTokens["styles"][number];

/**
 * Builds the file's tokens as Figma keeps them: every local collection with its modes and every variable's value per
 * mode, aliases kept; every variable an alias points at outside the file (a library's), with its collection; the
 * local styles; and, when asked, the styles and variables the layers under a node use, wherever they come from.
 */
export class RawTokensBuilder {
  readonly #raw: RawTokens;
  readonly #knownCollections: Set<string>;
  readonly #knownVariables: Set<string>;

  private constructor(raw: RawTokens) {
    this.#raw = raw;
    this.#knownCollections = new Set(raw.collections.map((collection) => collection.id));
    this.#knownVariables = new Set(raw.variables.map((variable) => variable.id));
  }

  /** The file's own tokens, with every variable their values point at, so every var() they write is defined. */
  static async local(): Promise<RawTokensBuilder> {
    const builder = new RawTokensBuilder({
      collections: (await figma.variables.getLocalVariableCollectionsAsync()).map(collectionOf),
      variables: (await figma.variables.getLocalVariablesAsync()).map(variableOf),
      external: {},
      styles: await localStyles(),
      ...colorProfile(),
    });

    await builder.#addVariables(builder.#raw.variables.flatMap((variable) => aliasesIn(variable.valuesByMode)));

    return builder;
  }

  /**
   * Adds the styles and variables the layers under `root` use and the file does not define (a team library's), and
   * the CSS of gradient paint styles from a layer that fills with them. A library style may share a name with another:
   * all are numbered again among the page's, as every reader numbers them, so a part of a page reads the same names.
   */
  async addUsed(root: BaseNode): Promise<void> {
    await loaded(root);

    const { styleIds, variableIds } = usedUnder(root);

    await this.#addStyles(styleIds);
    await this.#addVariables(variableIds);
    await this.#addPaintCss(root);

    const page = root.type === "PAGE" ? null : pageOf(root);

    this.#raw.styles = numbered(this.#raw.styles, page === null ? [] : await numberingStyles([page]));
  }

  build(): RawTokens {
    return this.#raw;
  }

  async #addStyles(ids: Iterable<string>): Promise<void> {
    const known = new Set(this.#raw.styles.map((style) => style.id));

    for (const id of ids) {
      const style = known.has(id) ? null : await figma.getStyleByIdAsync(id);

      if (style !== null) {
        this.#raw.styles.push({
          id,
          ...styleOf(style),
        });
        known.add(id);
      }
    }
  }

  /** Adds the variables with these ids not held yet, and every variable their values point at in turn. */
  async #addVariables(ids: readonly string[]): Promise<void> {
    const queue = [...ids];

    for (let index = 0; index < queue.length; index++) {
      queue.push(...(await this.#addVariable(queue[index] as string)));
    }
  }

  /** Adds one variable with its collection; the ids its values point at. One whose collection cannot be read is named in `external` only. */
  async #addVariable(id: string): Promise<string[]> {
    const held = this.#knownVariables.has(id) || this.#raw.external[id] !== undefined;
    const variable = held ? null : await figma.variables.getVariableByIdAsync(id);

    if (variable === null) {
      return [];
    }

    if (!(await this.#addCollection(variable.variableCollectionId))) {
      this.#raw.external[id] = {
        name: variable.name,
        collection: "",
        resolvedType: variable.resolvedType,
        ...codeSyntaxOf(variable),
      };

      return [];
    }

    const entry = variableOf(variable);

    this.#raw.variables.push(entry);
    this.#knownVariables.add(id);

    return aliasesIn(entry.valuesByMode);
  }

  /** Whether the collection is held, after adding it when Figma can read it. */
  async #addCollection(id: string): Promise<boolean> {
    if (this.#knownCollections.has(id)) {
      return true;
    }

    const collection = await figma.variables.getVariableCollectionByIdAsync(id);

    if (collection === null) {
      return false;
    }

    this.#raw.collections.push(collectionOf(collection));
    this.#knownCollections.add(id);

    return true;
  }

  /**
   * Each gradient or layered paint style's CSS, from the first layer under `root` it fills: core writes only single
   * solid paint styles itself, and Figma writes the rest for a layer (getCSSAsync's background).
   */
  async #addPaintCss(root: BaseNode): Promise<void> {
    const wanted = new Map(this.#raw.styles.filter(wantsCss).map((style) => [style.id, style]));

    if (wanted.size === 0 || !("findAll" in root)) {
      return;
    }

    for (const layer of root.findAll((node) => wanted.has(fillStyleOf(node) ?? ""))) {
      const style = wanted.get(fillStyleOf(layer) ?? "");

      if (style !== undefined && style.css === undefined && "getCSSAsync" in layer) {
        const css = unwrapVar((await layer.getCSSAsync()).background);

        if (css !== undefined) {
          style.css = css;
        }
      }
    }
  }
}

/** The file's tokens with those the layers under `root` use. */
export async function tokensUnder(root: BaseNode): Promise<RawTokens> {
  const builder = await RawTokensBuilder.local();

  await builder.addUsed(root);

  return builder.build();
}

/** The tokens each page other than the current one uses, page by page (loading every page is slow on big files). */
export async function tokensOfOtherPages(): Promise<RawTokens[]> {
  await figma.loadAllPagesAsync();

  const pages = figma.root.children.filter((page) => page.id !== figma.currentPage.id);
  const tokens: RawTokens[] = [];

  for (const page of pages) {
    tokens.push(await tokensUnder(page));
  }

  return tokens;
}

function collectionOf(collection: VariableCollection): RawCollection {
  return {
    id: collection.id,
    name: collection.name,
    remote: collection.remote,
    defaultModeId: collection.defaultModeId,
    modes: collection.modes.map(({ modeId, name }) => ({
      modeId,
      name,
    })),
  };
}

function variableOf(variable: Variable): RawVariable {
  return {
    id: variable.id,
    name: variable.name,
    collectionId: variable.variableCollectionId,
    resolvedType: variable.resolvedType,
    ...(variable.description === "" || variable.description === undefined ? {} : { description: variable.description }),
    scopes: [...(variable.scopes ?? [])],
    ...codeSyntaxOf(variable),
    valuesByMode: plain<Record<string, unknown>>(variable.valuesByMode),
  };
}

function codeSyntaxOf(variable: Pick<Variable, "codeSyntax">): { codeSyntax?: Record<string, string> } {
  const entries = Object.entries(variable.codeSyntax ?? {});

  return entries.length === 0 ? {} : { codeSyntax: Object.fromEntries(entries) };
}

/** A gradient paint style whose CSS no layer has given yet: only a gradient is worth asking Figma for (an image has none). */
function wantsCss(style: RawStyle): boolean {
  return (
    style.type === "PAINT" &&
    style.css === undefined &&
    (style.paints ?? []).some((paint) => (paint.visible ?? true) && paint.type.startsWith("GRADIENT_"))
  );
}

/** The paint style a layer is filled with, when one is. */
function fillStyleOf(node: BaseNode): string | null {
  return "fillStyleId" in node && typeof node.fillStyleId === "string" ? node.fillStyleId : null;
}
