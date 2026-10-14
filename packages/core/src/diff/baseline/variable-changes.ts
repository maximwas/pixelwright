import { type ColorSpace, colorSpaceOf } from "../../kernel/color/color-space.ts";
import { variableTokenName } from "../../kernel/names.ts";
import { variableCss } from "../../tokens/model/variable-css.ts";
import { Notes } from "../../tokens/notes.ts";
import type { RawCollection, RawTokens, RawVariable } from "../../tokens/raw-tokens.ts";
import type { TokenUses } from "./token-uses.ts";
import type { BaselineChanges } from "./types.ts";

type TokenEntry = BaselineChanges["tokens"][number];

/** A variable of one side: its names, its collection's modes, and its value in a mode as tokens_read writes it. */
interface SideVariable {
  readonly name: string;
  readonly token: string;
  readonly modes: readonly { modeId: string; name: string }[];
  value(modeId: string): string | null;
}

/** What a variable change is about: its id, and whether each side's layers use it. */
export interface VariableUse {
  readonly id: string;
  readonly before: boolean;
  readonly after: boolean;
}

/** One side's variables by id, written as tokens_read writes them (an alias as var()). */
export class SideVariables {
  readonly #variables: ReadonlyMap<string, RawVariable>;
  readonly #collections: ReadonlyMap<string, RawCollection>;
  readonly #names: ReadonlyMap<string, string>;
  readonly #space: ColorSpace;

  constructor(raw: RawTokens) {
    this.#variables = new Map(raw.variables.map((variable) => [variable.id, variable]));
    this.#collections = new Map(raw.collections.map((collection) => [collection.id, collection]));
    this.#names = new Map([
      ...raw.variables.map((variable) => [variable.id, variableTokenName(variable)] as const),
      ...Object.entries(raw.external).map(([id, variable]) => [id, variableTokenName(variable)] as const),
    ]);
    this.#space = colorSpaceOf(raw.colorProfile);
  }

  get(id: string): SideVariable | undefined {
    const variable = this.#variables.get(id);

    if (variable === undefined) {
      return undefined;
    }

    const context = {
      names: this.#names,
      space: this.#space,
      notes: new Notes(),
    };

    return {
      name: variable.name,
      token: this.#names.get(id) ?? variableTokenName(variable),
      modes: this.#collections.get(variable.collectionId)?.modes ?? [],
      value: (modeId) =>
        variable.valuesByMode[modeId] === undefined
          ? null
          : variableCss(variable.valuesByMode[modeId], variable, context),
    };
  }
}

/**
 * A variable's changes, mode by mode (matched by mode id, so a renamed mode keeps its values paired): a value changed, a
 * rename (was), newly used (before null) or no longer used (after null); `mode` only for collections of several modes.
 */
export function variableChanges(
  use: VariableUse,
  sides: { before: SideVariables; after: SideVariables },
  uses: { before: TokenUses; after: TokenUses },
): TokenEntry[] {
  const before = use.before ? sides.before.get(use.id) : undefined;
  const after = use.after ? sides.after.get(use.id) : undefined;
  const shown = after ?? before;

  if (shown === undefined) {
    return [];
  }

  const layers = after === undefined ? uses.before.count(shown.token) : uses.after.count(shown.token);
  const was = before !== undefined && after !== undefined && before.name !== after.name ? before.name : undefined;
  const modes = modesOf(before, after);
  const entries = modes.flatMap((mode) => {
    const pair = [before?.value(mode.modeId) ?? null, after?.value(mode.modeId) ?? null] as const;

    return pair[0] === pair[1] && before !== undefined && after !== undefined
      ? []
      : [
          entryOf(shown, {
            was,
            mode: modes.length > 1 ? mode.name : undefined,
            pair,
            layers,
          }),
        ];
  });

  if (entries.length === 0 && was !== undefined && after !== undefined) {
    const value = after.value(after.modes[0]?.modeId ?? "");

    return [
      entryOf(after, {
        was,
        mode: undefined,
        pair: [value, value],
        layers,
      }),
    ];
  }

  return entries;
}

/** The modes of both sides' collections, by id, the live side's names first. */
function modesOf(
  before: SideVariable | undefined,
  after: SideVariable | undefined,
): { modeId: string; name: string }[] {
  const modes = new Map<string, string>();

  for (const mode of [...(after?.modes ?? []), ...(before?.modes ?? [])]) {
    if (!modes.has(mode.modeId)) {
      modes.set(mode.modeId, mode.name);
    }
  }

  return [...modes].map(([modeId, name]) => ({
    modeId,
    name,
  }));
}

function entryOf(
  variable: SideVariable,
  {
    was,
    mode,
    pair,
    layers,
  }: {
    was: string | undefined;
    mode: string | undefined;
    pair: readonly [string | null, string | null];
    layers: number;
  },
): TokenEntry {
  return {
    token: variable.token,
    name: variable.name,
    ...(was === undefined ? {} : { was }),
    ...(mode === undefined ? {} : { mode }),
    before: pair[0],
    after: pair[1],
    layers,
  };
}
