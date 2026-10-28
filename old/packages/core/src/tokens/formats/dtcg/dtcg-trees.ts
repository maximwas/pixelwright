import type { ColorSpace } from "../../../kernel/color/color-space.ts";
import { colorSpaceOf } from "../../../kernel/color/color-space.ts";
import { aliasOf } from "../../aliases.ts";
import type { RawCollection, RawTokens, RawVariable } from "../../raw-tokens.ts";
import { filteredCollections, type TokenFilter } from "../../token-filter.ts";
import { uniqueName } from "../../unique-name.ts";
import { DTCG_STYLES } from "./constants.ts";
import { treeKeyOf } from "./dtcg-paths.ts";
import { DtcgReferences } from "./dtcg-references.ts";
import { stylesTree } from "./dtcg-styles.ts";
import { DtcgTreeBuilder } from "./dtcg-tree.ts";
import { dtcgTypes } from "./dtcg-types.ts";
import { dtcgValue } from "./dtcg-values.ts";
import type { DtcgGroup, DtcgResult, DtcgToken } from "./types.ts";

/**
 * The file's tokens in the Design Tokens Format (DTCG 2025.10): a tree per mode of each collection, keyed
 * `<collection>.<mode>` (the collection alone when it has one mode), and a `styles` tree. Paths come from the names'
 * "/" segments; a token whose path is also a group sits at the group's `$root`. What DTCG has no type for is named in
 * notes, never dropped silently.
 */
export function dtcgTrees(raw: RawTokens, filter: TokenFilter = {}): DtcgResult {
  const collections = filteredCollections(raw, filter);
  const space = colorSpaceOf(raw.colorProfile);
  const writer = new VariableTrees(raw, new Set(collections.map((collection) => collection.id)), space);
  const keys = new Set([DTCG_STYLES]);
  const trees: Record<string, DtcgGroup> = {};

  for (const collection of collections) {
    Object.assign(trees, writer.treesOf(collection, keys));
  }

  const styles = stylesTree(raw.styles, space);

  trees[DTCG_STYLES] = styles.tree;

  return {
    trees,
    notes: [...writer.notes(), ...styles.notes],
  };
}

/** Writes the collections' trees, remembering what it had to leave out or rename for the notes. */
class VariableTrees {
  readonly #raw: RawTokens;
  readonly #space: ColorSpace;
  readonly #types: ReadonlyMap<string, string | null>;
  readonly #references: DtcgReferences;
  readonly #renamed: string[] = [];
  readonly #untyped = new Map<string, string>();
  readonly #lost = new Set<string>();
  readonly #outside = new Map<string, string>();

  constructor(raw: RawTokens, included: ReadonlySet<string>, space: ColorSpace) {
    this.#raw = raw;
    this.#space = space;
    this.#types = dtcgTypes(raw);
    this.#references = new DtcgReferences(raw, this.#types, included);
  }

  /** A collection's trees by key: one per mode, or the collection's alone when it has one mode. */
  treesOf(collection: RawCollection, keys: Set<string>): Record<string, DtcgGroup> {
    const wanted = treeKeyOf(collection.name);
    const key = uniqueName(wanted, keys);
    const modes = new Set<string>();
    const variables = this.#raw.variables.filter((variable) => variable.collectionId === collection.id);
    const trees: Record<string, DtcgGroup> = {};

    if (key !== wanted) {
      this.#renamed.push(`The collection ${collection.name} is written as ${key}: ${wanted} is taken.`);
    }

    for (const mode of collection.modes) {
      const tree = this.#modeTree(variables, mode.modeId);

      trees[collection.modes.length === 1 ? key : `${key}.${uniqueName(treeKeyOf(mode.name), modes)}`] = tree;
    }

    return trees;
  }

  /** What could not be written as it is, in the order: renames, untyped variables, lost and outside aliases. */
  notes(): string[] {
    const untyped = [...this.#untyped];
    const count = untyped.length;

    return [
      ...this.#renamed,
      ...this.#references.renamed,
      ...(count === 0
        ? []
        : [
            `${count} variable${count === 1 ? " has" : "s have"} no DTCG type and ${count === 1 ? "is" : "are"} left out: ${untyped.map(([name, type]) => `${name} (${type})`).join(", ")}.`,
          ]),
      ...[...this.#lost].map(
        (name) => `${name} points at a variable that is neither in this file nor in a library it uses: left out.`,
      ),
      ...this.#outside.values(),
    ];
  }

  #modeTree(variables: readonly RawVariable[], modeId: string): DtcgGroup {
    const builder = new DtcgTreeBuilder();

    for (const variable of variables) {
      const token = this.#tokenOf(variable, variable.valuesByMode[modeId]);

      if (token !== null) {
        builder.put(this.#references.location(variable.id), token);
      }
    }

    return builder.build();
  }

  /** The variable's token in one mode: its value, or a reference to the token an alias points at. */
  #tokenOf(variable: RawVariable, value: unknown): DtcgToken | null {
    const type = this.#types.get(variable.id) ?? null;

    if (type === null) {
      this.#untyped.set(variable.name, variable.resolvedType);

      return null;
    }

    const alias = aliasOf(value);
    const reference = alias === null ? undefined : this.#references.reference(alias);

    if (alias !== null && reference === undefined) {
      this.#lost.add(variable.name);

      return null;
    }

    const elsewhere = alias === null ? null : this.#references.outside(alias);

    if (elsewhere !== null) {
      this.#outside.set(variable.name, `${variable.name} points at ${elsewhere}`);
    }

    return {
      $type: type,
      $value: reference ?? dtcgValue(type, value, this.#space),
      ...(variable.description === undefined || variable.description === ""
        ? {}
        : { $description: variable.description }),
    };
  }
}
