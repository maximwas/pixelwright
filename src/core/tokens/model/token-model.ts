import { InjectionToken, inject, injectable } from "@needle-di/core";
import { MODE_ATTRIBUTE } from "@/core/kernel/names/names.constants.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { MODEL_NOTE, MODEL_NUMBER, MODEL_TEXT, VARIABLE_VALUE } from "@/core/tokens/model/model.constants.ts";
import type {
  ReadyTokens,
  StyleTokenGroups,
  TokenCollection,
  TokenVariable,
} from "@/core/tokens/model/model.schema.ts";
import { NUMBER_UNITS } from "@/core/tokens/model/number-units.ts";
import { STYLE_TOKENS } from "@/core/tokens/model/style-tokens.ts";
import { VARIABLE_CSS, type VariableContext } from "@/core/tokens/model/variable-css.ts";
import type { RawCollection, RawTokens, RawVariable } from "@/shared/ops/variables/variables.schema.ts";
import type { ModelTables } from "@/shared/read-model/read-model.schema.ts";

type Draft = Omit<TokenCollection, "selectors">;

/**
 * A file's tokens ready for code (T-160): each collection asked for (all by default, names in any case) with its modes
 * by name and its selectors, each variable named as design_read names it and written as CSS in every mode (an alias
 * as `var(--other)`), and the paint, text and effect styles. Notes say what could not be written as asked, and which
 * collection holds a var() target the output leaves out, found from the aliases themselves (K-005).
 */
@injectable()
export class TokenModel {
  readonly #variables;
  readonly #styles;
  readonly #units;
  readonly #names;

  constructor(
    variables = inject(VARIABLE_CSS),
    styles = inject(STYLE_TOKENS),
    units = inject(NUMBER_UNITS),
    names = inject(TOKEN_NAMES),
  ) {
    this.#variables = variables;
    this.#styles = styles;
    this.#units = units;
    this.#names = names;
  }

  model(
    raw: RawTokens,
    collections?: readonly string[],
    query?: readonly string[],
  ): ReadyTokens {
    const names = this.#tokenNames(raw);
    const context: VariableContext = {
      tables: this.#tables(raw),
      names,
      units: this.#units.units(raw.variables),
      notes: new Set(),
    };
    const wanted = new Set(collections?.map((name) => name.toLowerCase()));
    const kept = raw.collections.filter(
      (collection) => collections === undefined || wanted.has(collection.name.toLowerCase()),
    );
    const matches = this.#matcher(query);
    const scope = raw.variables.filter((variable) => matches(variable.name, context.names.get(variable.id) ?? ""));
    const drafts = kept
      .map((collection) => this.#draft(collection, scope, context))
      .filter(({ variables }) => query === undefined || variables.length > 0);
    const selectors = this.#selectors(drafts, context.notes);
    const written = drafts.map(({ variables, ...collection }, index) => ({
      ...collection,
      selectors: selectors[index] ?? {},
      variables,
    }));

    this.#noteMissing(kept, scope, raw, context);

    const styles = this.#queried(this.#styles.tokens(raw.styles, context.tables, context.notes), matches);

    return { collections: written, styles, notes: [...context.notes] };
  }

  /** Whether any of the words is in the texts given, in any case; every text without a query. */
  #matcher(query: readonly string[] | undefined): (...texts: string[]) => boolean {
    const words = query?.map((word) => word.toLowerCase());

    return (...texts) =>
      words === undefined || words.some((word) => texts.some((text) => text.toLowerCase().includes(word)));
  }

  /** The styles whose name or token has a word of the query. */
  #queried(styles: StyleTokenGroups, matches: (...texts: string[]) => boolean): StyleTokenGroups {
    const keep = (group: StyleTokenGroups["paint"]) => group.filter(({ name, token }) => matches(name, token));

    return { paint: keep(styles.paint), text: keep(styles.text), effect: keep(styles.effect) };
  }

  /** Every variable's CSS name by id, the file's own and the libraries' its aliases point at. */
  #tokenNames(raw: RawTokens): Map<string, string> {
    return new Map([
      ...raw.variables.map((variable) => [variable.id, this.#names.variable(variable)] as const),
      ...Object.entries(raw.external).map(([id, variable]) => [id, this.#names.variable(variable)] as const),
    ]);
  }

  /** The read's tables the CSS mapping takes: the colour profile, and each variable with its default mode's value. */
  #tables(raw: RawTokens): ModelTables {
    const collections = new Map(raw.collections.map((collection) => [collection.id, collection]));
    const own = raw.variables.map((variable) => {
      const collection = collections.get(variable.collectionId);
      const value = collection === undefined ? undefined : variable.valuesByMode[collection.defaultModeId];

      return [
        variable.id,
        {
          name: variable.name,
          collection: collection?.name ?? "",
          resolvedType: variable.resolvedType,
          remote: collection?.remote ?? false,
          ...(value === undefined ? {} : { value }),
          ...(variable.codeSyntax === undefined ? {} : { codeSyntax: variable.codeSyntax }),
        },
      ] as const;
    });
    const external = Object.entries(raw.external).map(
      ([id, { codeSyntax, ...variable }]) =>
        [id, { ...variable, remote: true, ...(codeSyntax === undefined ? {} : { codeSyntax }) }] as const,
    );

    return {
      ...(raw.colorProfile === undefined ? {} : { colorProfile: raw.colorProfile }),
      styles: {},
      variables: Object.fromEntries([...own, ...external]),
    };
  }

  #draft(
    collection: RawCollection,
    variables: readonly RawVariable[],
    context: VariableContext,
  ): Draft {
    return {
      name: collection.name,
      modes: collection.modes.map(({ name }) => name),
      defaultMode:
        collection.modes.find(({ modeId }) => modeId === collection.defaultModeId)?.name ??
        collection.modes[0]?.name ??
        "",
      variables: variables
        .filter((variable) => variable.collectionId === collection.id)
        .map((variable) => this.#variable(variable, collection, context)),
    };
  }

  #variable(
    variable: RawVariable,
    collection: RawCollection,
    context: VariableContext,
  ): TokenVariable {
    const everyField = variable.scopes.length === 1 && variable.scopes[0] === VARIABLE_VALUE.allScopes;

    const chains = collection.modes.flatMap(({ modeId, name }) => {
      const links = this.#variables.chain(variable.valuesByMode[modeId], context);

      return links === null ? [] : [[name, links] as const];
    });

    return {
      id: variable.id,
      name: variable.name,
      token: context.names.get(variable.id) ?? this.#names.token(variable.name),
      type: variable.resolvedType,
      values: Object.fromEntries(
        collection.modes.map(({ modeId, name }) => [
          name,
          this.#variables.css(variable.valuesByMode[modeId], variable, context),
        ]),
      ),
      ...(chains.length === 0 ? {} : { aliasOf: Object.fromEntries(chains) }),
      ...(variable.description === undefined ? {} : { description: variable.description }),
      ...(everyField ? {} : { scopes: [...variable.scopes] }),
      ...(Object.keys(variable.codeSyntax ?? {}).length === 0 ? {} : { codeSyntax: { ...variable.codeSyntax } }),
    };
  }

  /**
   * Each collection's selectors by mode, the default's first: `[data-<collection>="<mode>"]` for every mode of a
   * collection with more than one, design_read's slugs; two that would share one get -2, with a note.
   */
  #selectors(drafts: readonly Draft[], notes: Set<string>): Record<string, string>[] {
    const attributes = new Set<string>();

    return drafts.map((collection) => {
      const attribute = MODE_ATTRIBUTE.name(this.#unique(this.#names.attribute(collection.name), attributes));
      const values = new Set<string>();
      const modes =
        collection.modes.length > 1
          ? [collection.defaultMode, ...collection.modes.filter((mode) => mode !== collection.defaultMode)]
          : [];

      return Object.fromEntries(
        modes.map((mode) => {
          const wanted = this.#names.attribute(mode);
          const slug = this.#unique(wanted, values);

          if (slug !== wanted) {
            notes.add(MODEL_NOTE.sharedSelector(mode, collection.name, wanted, slug));
          }

          return [mode, MODEL_TEXT.selector(attribute, slug)];
        }),
      );
    });
  }

  /** The wanted name, or the first of -2, -3… not taken yet; the name returned is taken from then on. */
  #unique(wanted: string, taken: Set<string>): string {
    let candidate = wanted;

    for (let index = MODEL_NUMBER.firstCopy; taken.has(candidate); index++) {
      candidate = MODEL_TEXT.copy(wanted, index);
    }

    taken.add(candidate);

    return candidate;
  }

  /** Every var() target the written values point at but the output does not define, noted with where it lives. */
  #noteMissing(
    kept: readonly RawCollection[],
    scope: readonly RawVariable[],
    raw: RawTokens,
    { names, notes }: VariableContext,
  ): void {
    const written = kept.flatMap((collection) =>
      scope.filter((variable) => variable.collectionId === collection.id).map((variable) => ({ variable, collection })),
    );
    const defined = new Set(written.map(({ variable }) => names.get(variable.id)));
    const homes = this.#homes(raw, names);
    const targets = written.flatMap(({ variable, collection }) =>
      collection.modes.flatMap(({ modeId }) => this.#aliases(variable.valuesByMode[modeId])),
    );

    for (const id of targets) {
      const token = names.get(id);
      const home = token === undefined ? "" : (homes.get(token) ?? "");

      if (token !== undefined && !defined.has(token)) {
        notes.add(home === "" ? MODEL_NOTE.nowhere(token) : MODEL_NOTE.missing(token, home));
      }
    }
  }

  /** The collection each token's variable lives in, by token: the file's own by name, a library's said so. */
  #homes(raw: RawTokens, names: ReadonlyMap<string, string>): Map<string, string> {
    const collections = new Map(raw.collections.map((collection) => [collection.id, collection.name]));

    return new Map([
      ...raw.variables.map(
        (variable) => [names.get(variable.id) ?? "", collections.get(variable.collectionId) ?? ""] as const,
      ),
      ...Object.entries(raw.external).map(
        ([id, variable]) => [names.get(id) ?? "", MODEL_NOTE.library(variable.collection)] as const,
      ),
    ]);
  }

  /** The variables a value points at: an alias, or a composed colour's colour and opacity. */
  #aliases(value: unknown): string[] {
    const alias = this.#units.alias(value);

    if (alias !== null) {
      return [alias];
    }

    return typeof value === "object" && value !== null && "color" in value && "opacity" in value
      ? [...this.#aliases(value.color), ...this.#aliases(value.opacity)]
      : [];
  }
}

export const TOKEN_MODEL = new InjectionToken<TokenModel>("TokenModel");
