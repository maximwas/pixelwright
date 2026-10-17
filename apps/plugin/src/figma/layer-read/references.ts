import { MIXED, type SnapshotStyle, type SnapshotVariable } from "@pixelwright/core";
import { numbered, numberingStyles, ownStyles, styleOf } from "../../figma/styles.ts";
import { plain } from "../../utils/plain.ts";
import { CollectionLookup } from "../variable-modes.ts";

/** The styles and variables a read's layers use, resolved once at the end; a variable keeps its first consumer. */
export class References {
  /** The variable collections the read's modes name, each looked up once. */
  readonly collections = new CollectionLookup();
  readonly #styles = new Set<string>();
  readonly #variables = new Map<string, SceneNode>();

  /** A variable a layer uses, unless an earlier layer of the read did. */
  useVariable(id: string, consumer: SceneNode): void {
    if (!this.#variables.has(id)) {
      this.#variables.set(id, consumer);
    }
  }

  /** Every style id and variable alias inside an entry: its own fields, paints, effects and text segments. */
  collect(value: unknown, node: SceneNode): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        this.collect(item, node);
      }

      return;
    }

    if (typeof value !== "object" || value === null) {
      return;
    }

    const record = value as Record<string, unknown>;

    if (record.type === "VARIABLE_ALIAS" && typeof record.id === "string") {
      this.useVariable(record.id, node);

      return;
    }

    for (const [key, item] of Object.entries(record)) {
      this.#collectField(key, item, node);
    }
  }

  /** A style a field names, or whatever its value holds; Figma's CSS and a text's characters hold none. */
  #collectField(key: string, item: unknown, node: SceneNode): void {
    if (!key.endsWith("StyleId")) {
      if (key !== "css" && key !== "characters") {
        this.collect(item, node);
      }

      return;
    }

    if (typeof item === "string" && item !== "" && item !== MIXED) {
      this.#styles.add(item);
    }
  }

  /**
   * The styles the layers use, numbered where names repeat (the second Black is --Black-2): among the file's own, and,
   * once a library style is used, among the styles their pages use too, as every reader numbers them.
   */
  async styles(pages: Iterable<PageNode | null>): Promise<Record<string, SnapshotStyle>> {
    const used: (SnapshotStyle & { id: string })[] = [];
    // The file's own from its lists, which Figma gives offline too; a library's by id, left out if unreachable.
    const own =
      this.#styles.size === 0
        ? new Map<string, BaseStyle>()
        : new Map((await ownStyles()).map((style) => [style.id, style]));

    for (const id of this.#styles) {
      const style = own.get(id) ?? (await figma.getStyleByIdAsync(id).catch(() => null));

      if (style !== null) {
        used.push({
          id,
          ...styleOf(style),
        });
      }
    }

    if (used.length === 0) {
      return {};
    }

    const among = await numberingStyles(
      used.some((style) => style.remote) ? [...pages].filter((page): page is PageNode => page !== null) : [],
    );

    return Object.fromEntries(numbered(used, among).map(({ id, ...style }) => [id, style]));
  }

  /**
   * The variables the layers use, each resolved for its first consumer: the file's own from its list, which Figma
   * gives offline too (a lookup by id waits ten seconds and fails then), a library's by id, left out if unreachable.
   */
  async variables(): Promise<Record<string, SnapshotVariable>> {
    const variables: Record<string, SnapshotVariable> = {};
    const local =
      this.#variables.size === 0
        ? new Map<string, Variable>()
        : new Map((await figma.variables.getLocalVariablesAsync()).map((variable) => [variable.id, variable]));

    for (const [id, consumer] of this.#variables) {
      const variable = local.get(id) ?? (await figma.variables.getVariableByIdAsync(id).catch(() => null));

      if (variable !== null) {
        variables[id] = await variableOf(variable, consumer, this.collections);
      }
    }

    return variables;
  }
}

async function variableOf(
  variable: Variable,
  consumer: SceneNode,
  collections: CollectionLookup,
): Promise<SnapshotVariable> {
  const collection = await collections.get(variable.variableCollectionId);
  let value: unknown;

  try {
    value = plain(variable.resolveForConsumer(consumer).value);
  } catch {
    // Figma cannot resolve some variables for some layers (a mode the layer does not have): the name still names it.
  }

  return {
    name: variable.name,
    collection: collection?.name ?? "",
    resolvedType: variable.resolvedType,
    remote: variable.remote,
    ...(value === undefined ? {} : { value }),
    ...(isFilled(variable.codeSyntax) ? { codeSyntax: { ...variable.codeSyntax } } : {}),
  };
}

/** An object with at least one key. */
export function isFilled(value: unknown): value is object {
  return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}
