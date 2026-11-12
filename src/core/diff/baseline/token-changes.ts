import { InjectionToken, inject, injectable } from "@needle-di/core";
import { uniqBy } from "es-toolkit";
import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";
import { BASELINE_CHANGE_TEXT, TOKEN_CHANGE } from "@/core/diff/baseline/baseline.constants.ts";
import type { BaselineChanges } from "@/core/diff/baseline/baseline.schema.ts";
import type {
  Both,
  BoundTokens,
  ElementValues,
  SideTokens,
  SideVariable,
  TokenEntryParts,
  TokenSide,
  VariableUse,
} from "@/core/diff/baseline/baseline.types.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { STYLE_GROUP, STYLE_GROUPS } from "@/core/tokens/model/model.constants.ts";
import { NUMBER_UNITS } from "@/core/tokens/model/number-units.ts";
import { STYLE_TOKENS } from "@/core/tokens/model/style-tokens.ts";
import { VARIABLE_CSS } from "@/core/tokens/model/variable-css.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { RawCollection, RawTokens, RawVariable } from "@/shared/ops/variables/variables.schema.ts";
import type { ModelTables, ReadModel } from "@/shared/read-model/read-model.schema.ts";

type TokenEntry = BaselineChanges["tokens"][number];
type ReadStyle = ReadModel["styles"][string];
type Mode = RawCollection["modes"][number];
type Uses = readonly ElementValues[];

/**
 * The tokens either side's compared layers use, matched by id (K-057): a variable's value mode by mode (paired by mode
 * id, so a renamed mode keeps its values), renamed (`was`), newly used (before null) or no longer used (after null),
 * with how many elements use it; a style's value as tokens_read writes it. Used variables are the bound ones (aliases
 * anywhere in the read, never `inferred` or `css`: m:335a001e) and those their aliases reach, a primitive counted through
 * the bound ones reaching it. Without raw tokens on a side both reads' variable tables stand in, one mode, with a note.
 */
@injectable()
export class TokenChanges {
  readonly #notBound: ReadonlySet<string> = new Set(TOKEN_CHANGE.notBound);
  readonly #css;
  readonly #styles;
  readonly #units;
  readonly #names;

  constructor(
    css = inject(VARIABLE_CSS),
    styles = inject(STYLE_TOKENS),
    units = inject(NUMBER_UNITS),
    names = inject(TOKEN_NAMES),
  ) {
    this.#css = css;
    this.#styles = styles;
    this.#units = units;
    this.#names = names;
  }

  of(sides: Both<TokenSide>, notes: string[]): TokenEntry[] {
    const asRead = sides.before.raw === null || sides.after.raw === null;

    if (asRead) {
      notes.push(BASELINE_CHANGE_TEXT.tokensAsRead(sides.before.raw === null));
    }

    const uses = { before: this.#uses(sides.before), after: this.#uses(sides.after) };
    const bound = { before: this.#bound(sides.before), after: this.#bound(sides.after) };
    const raw = { before: this.#raw(sides.before, asRead), after: this.#raw(sides.after, asRead) };
    const tokens = { before: this.#sideTokens(raw.before), after: this.#sideTokens(raw.after) };
    const used = {
      before: this.#used(bound.before.variables, raw.before),
      after: this.#used(bound.after.variables, raw.after),
    };
    const variables = [...new Set([...used.after.keys(), ...used.before.keys()])].flatMap((id) =>
      this.#variableChanges({ id, before: used.before.get(id), after: used.after.get(id) }, tokens, uses),
    );
    const styles = this.#styleChanges(sides, { before: bound.before.styles, after: bound.after.styles }, uses);

    return [...variables, ...styles];
  }

  #raw(side: TokenSide, asRead: boolean): RawTokens {
    return asRead || side.raw === null ? this.#fromRead(side.snapshot) : side.raw;
  }

  /** A read's own variable table as raw tokens: one collection, one mode, each at the value the read gives it. */
  #fromRead(model: ReadModel): RawTokens {
    const { readCollection, readMode } = TOKEN_CHANGE;
    const modes = [{ modeId: readMode, name: readMode }];

    return {
      collections: [{ id: readCollection, name: readCollection, remote: false, defaultModeId: readMode, modes }],
      variables: Object.entries(model.variables).map(([id, variable]) => ({
        id,
        name: variable.name,
        collectionId: readCollection,
        resolvedType: variable.resolvedType,
        scopes: [],
        ...(variable.codeSyntax === undefined ? {} : { codeSyntax: variable.codeSyntax }),
        valuesByMode: variable.value === undefined ? {} : { [readMode]: variable.value },
      })),
      external: {},
      styles: [],
      ...(model.colorProfile === undefined ? {} : { colorProfile: model.colorProfile }),
    };
  }

  #sideTokens(raw: RawTokens): SideTokens {
    const names = new Map([
      ...raw.variables.map((variable) => [variable.id, this.#names.variable(variable)] as const),
      ...Object.entries(raw.external).map(([id, variable]) => [id, this.#names.variable(variable)] as const),
    ]);
    const units = this.#units.units(raw.variables);

    return {
      variables: new Map(raw.variables.map((variable) => [variable.id, variable])),
      collections: new Map(raw.collections.map((collection) => [collection.id, collection])),
      context: { tables: this.#tables(raw.colorProfile), names, units, notes: new Set() },
    };
  }

  /** Only the colour profile: a value is compared as written, not through the read's variables. */
  #tables(colorProfile: string | undefined): ModelTables {
    return { ...(colorProfile === undefined ? {} : { colorProfile }), styles: {}, variables: {} };
  }

  #variable(side: SideTokens, id: string): SideVariable | undefined {
    const variable = side.variables.get(id);

    if (variable === undefined) {
      return undefined;
    }

    const token = side.context.names.get(id) ?? this.#names.variable(variable);

    return { variable, token, modes: side.collections.get(variable.collectionId)?.modes ?? [], side };
  }

  #value(shown: SideVariable | undefined, modeId: string): string | null {
    const value = shown?.variable.valuesByMode[modeId];

    return shown === undefined || value === undefined ? null : this.#css.css(value, shown.variable, shown.side.context);
  }

  /** One variable's entries, mode by mode (`mode` only for collections of several); a rename alone is one entry. */
  #variableChanges(
    use: VariableUse,
    tokens: Both<SideTokens>,
    uses: Both<Uses>,
  ): TokenEntry[] {
    const before = use.before === undefined ? undefined : this.#variable(tokens.before, use.id);
    const after = use.after === undefined ? undefined : this.#variable(tokens.after, use.id);
    const shown = after ?? before;

    if (shown === undefined) {
      return [];
    }

    const layers =
      after === undefined ? this.#layers(shown, use.before, uses.before) : this.#layers(shown, use.after, uses.after);
    const renamed = before !== undefined && after !== undefined && before.variable.name !== after.variable.name;
    const was = renamed ? before.variable.name : undefined;
    // Modes by id, the live side's names first: a renamed mode keeps its values paired.
    const modes: Mode[] = uniqBy([...(after?.modes ?? []), ...(before?.modes ?? [])], ({ modeId }) => modeId);
    const entries = modes.flatMap((mode) => {
      const pair = [this.#value(before, mode.modeId), this.#value(after, mode.modeId)] as const;
      const parts = { was, mode: modes.length > 1 ? mode.name : undefined, pair, layers };

      return pair[0] === pair[1] && before !== undefined && after !== undefined ? [] : [this.#entry(shown, parts)];
    });

    if (entries.length === 0 && was !== undefined && after !== undefined) {
      const value = this.#value(after, after.modes[0]?.modeId ?? "");

      return [this.#entry(after, { was, mode: undefined, pair: [value, value], layers })];
    }

    return entries;
  }

  /** The elements that use a variable: bound to it, or to an alias reaching it. */
  #layers(
    shown: SideVariable,
    through: readonly string[] | undefined,
    uses: Uses,
  ): number {
    const names = shown.side.context.names;

    return (through ?? []).reduce(
      (count, id) => count + this.#count(uses, names.get(id)),
      this.#count(uses, shown.token),
    );
  }

  #entry(shown: SideVariable, { was, mode, pair, layers }: TokenEntryParts): TokenEntry {
    return {
      token: shown.token,
      name: shown.variable.name,
      ...(was === undefined ? {} : { was }),
      ...(mode === undefined ? {} : { mode }),
      before: pair[0],
      after: pair[1],
      layers,
    };
  }

  /** The bound variables and the ones they alias at any depth, each with the bound ones it is reached through. */
  #used(bound: ReadonlySet<string>, raw: RawTokens): Map<string, readonly string[]> {
    const byId = new Map(raw.variables.map((variable) => [variable.id, variable]));
    const reached = new Map<string, Set<string>>();

    for (const start of bound) {
      for (const target of this.#closure(start, byId)) {
        if (!bound.has(target)) {
          reached.set(target, (reached.get(target) ?? new Set()).add(start));
        }
      }
    }

    return new Map<string, readonly string[]>([
      ...[...bound].map((id) => [id, []] as const),
      ...[...reached].map(([id, through]) => [id, [...through]] as const),
    ]);
  }

  /** The variables one aliases at any depth, itself left out. */
  #closure(start: string, byId: ReadonlyMap<string, RawVariable>): Set<string> {
    const seen = new Set([start]);
    const queue = [start];

    // The queue grows as aliases reach further: for-of reads what was pushed meanwhile.
    for (const id of queue) {
      for (const value of Object.values(byId.get(id)?.valuesByMode ?? {})) {
        const target = this.#units.alias(value);

        if (target !== null && !seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      }
    }

    seen.delete(start);

    return seen;
  }

  #bound(side: TokenSide): BoundTokens {
    const found: BoundTokens = { variables: new Set(), styles: new Set() };

    this.#collect(side.snapshot.root, "", side.skip, found);

    return found;
  }

  /** Every value of the read's layers with its field's name; a child in `skip` is not walked into. */
  #collect(
    value: unknown,
    key: string,
    skip: ReadonlySet<string>,
    found: BoundTokens,
  ): void {
    const alias = this.#units.alias(value);

    if (alias !== null) {
      found.variables.add(alias);
    } else if (key.endsWith(TOKEN_CHANGE.styleIdSuffix) && typeof value === "string" && value !== "") {
      found.styles.add(value);
    } else if (Array.isArray(value)) {
      for (const item of value.filter((each) => key !== TOKEN_CHANGE.children || !skip.has(this.#idOf(each)))) {
        this.#collect(item, key, skip, found);
      }
    } else if (typeof value === "object" && value !== null && !this.#notBound.has(key)) {
      for (const [name, item] of Object.entries(value)) {
        this.#collect(item, name, skip, found);
      }
    }
  }

  #idOf(value: unknown): string {
    return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" ? value.id : "";
  }

  /** The styles either side's compared layers use, as their token values (a text style as its font shorthand), by id. */
  #styleChanges(
    sides: Both<TokenSide>,
    used: Both<ReadonlySet<string>>,
    uses: Both<Uses>,
  ): TokenEntry[] {
    return [...new Set([...used.after, ...used.before])].flatMap((id) => {
      const styles = {
        before: used.before.has(id) ? sides.before.snapshot.styles[id] : undefined,
        after: used.after.has(id) ? sides.after.snapshot.styles[id] : undefined,
      };
      const change = this.#styleChange(id, styles, sides, uses);

      return change === null ? [] : [change];
    });
  }

  /** One style's change: its value, a rename, newly used or no longer used; null when it is the same. */
  #styleChange(
    id: string,
    styles: Both<ReadStyle | undefined>,
    sides: Both<TokenSide>,
    uses: Both<Uses>,
  ): TokenEntry | null {
    const { before, after } = styles;
    const shown = after ?? before;
    const pair = [
      this.#styleValue(id, before, sides.before.snapshot),
      this.#styleValue(id, after, sides.after.snapshot),
    ] as const;
    const was = before !== undefined && after !== undefined && before.name !== after.name ? before.name : undefined;

    if (shown === undefined || (pair[0] === pair[1] && was === undefined)) {
      return null;
    }

    const token = this.#names.style(shown);
    const textStyle = STYLE_GROUPS[shown.type] === STYLE_GROUP.text ? this.#names.styleName(shown) : undefined;
    const layers = this.#count(after === undefined ? uses.before : uses.after, token, textStyle);

    return { token, name: shown.name, ...(was === undefined ? {} : { was }), before: pair[0], after: pair[1], layers };
  }

  /** A style's token value as tokens_read writes it; null when the side does not use it. */
  #styleValue(
    id: string,
    style: ReadStyle | undefined,
    model: ReadModel,
  ): string | null {
    if (style === undefined) {
      return null;
    }

    const written = this.#styles.tokens([{ ...style, id }], this.#tables(model.colorProfile), new Set());
    const [token] = [...written.paint, ...written.text, ...written.effect];

    return token?.value ?? null;
  }

  /** Each compared element's values; the layers under a cut are left out. */
  #uses(side: TokenSide): ElementValues[] {
    return [...side.layers.values()]
      .filter(({ element }) => !side.skip.has(element.id))
      .map(({ element }) => {
        const spans = (element.content ?? []).flatMap((piece) =>
          piece.kind === XML_CONTENT.span ? piece.attributes : [],
        );

        return {
          values: [...element.attributes, ...spans].map(([, value]) => value),
          textStyle: element.attributes.find(([name]) => name === DESIGN_ATTRIBUTE.textStyle)?.[1],
        };
      });
  }

  /** How many elements use the token (in an attribute or a run), or name the text style. */
  #count(
    uses: Uses,
    token: string | undefined,
    textStyle?: string,
  ): number {
    const used = token === undefined ? null : BASELINE_CHANGE_TEXT.used(token);

    return uses.filter(
      (element) =>
        (used !== null && element.values.some((value) => value.includes(used))) ||
        (textStyle !== undefined && element.textStyle === textStyle),
    ).length;
  }
}

export const TOKEN_CHANGES = new InjectionToken<TokenChanges>("TokenChanges");
