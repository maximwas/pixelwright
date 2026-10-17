import { closest, type RawTokens, styleName, styleTokenName, variableTokenName } from "@pixelwright/core";
import { IdLookup } from "../id-lookup.ts";
import { WriteError } from "../write-error.ts";
import { type LibraryVariable, libraryVariablesByToken } from "./libraries.ts";
import { tokensOfOtherPages, tokensUnder } from "./raw-tokens-builder.ts";

export type StyleKind = "PAINT" | "EFFECT" | "TEXT";

/** A variable as a check needs it: a library's not yet imported has the id `library:<key>`. */
export interface VariableRef {
  readonly id: string;
  readonly name: string;
  readonly resolvedType: string;
}

/**
 * Tokens by the CSS names design_read gives them (text styles also by their own name, as textStyle names them): the
 * file's styles and variables and the library ones its pages use, then the enabled libraries' variables, so what a
 * read wrote binds back wherever the file uses it. Built from what the current page uses; a name it lacks is looked
 * for once on the file's other pages, then a variable among the enabled libraries'. One index serves one call.
 */
export class TokenIndex {
  /** The call's lookups by id: the file's own variables from its list, so binding works offline too. */
  readonly lookup: IdLookup;
  readonly #styles = new Map<string, string>();
  readonly #textStyles = new Map<string, string>();
  readonly #variables = new Map<string, { readonly id: string; readonly resolvedType: string }>();
  readonly #imports = new Map<string, Promise<Variable>>();
  #otherPages: Promise<void> | null = null;
  #libraries: Promise<Map<string, LibraryVariable>> | null = null;

  private constructor(lookup: IdLookup) {
    this.lookup = lookup;
  }

  /** The index of what the current page uses, finding variables through the call's lookup. */
  static async of(lookup: IdLookup = new IdLookup()): Promise<TokenIndex> {
    const index = new TokenIndex(lookup);

    index.#take(await tokensUnder(figma.currentPage));

    return index;
  }

  /** A style's id, or null when no style of that kind has the name. A name a variable has is never looked for farther. */
  async style(token: string, kind: StyleKind): Promise<string | null> {
    const key = `${kind} ${token}`;

    if (!this.#styles.has(key) && !this.#variables.has(token)) {
      await this.#lookOnOtherPages();
    }

    return this.#styles.get(key) ?? null;
  }

  /** A text style's id by its name; an error naming close ones when none has it. */
  async textStyle(name: string): Promise<string> {
    if (!this.#textStyles.has(name)) {
      await this.#lookOnOtherPages();
    }

    const id = this.#textStyles.get(name);

    if (id === undefined) {
      throw unknownToken("text style", name, this.#textStyles.keys());
    }

    return id;
  }

  /**
   * The variable of the type (of any type when none is given), a library's imported into the file (a write), once per
   * call however often it is named; an error naming close tokens when none has the name.
   */
  async variable(token: string, type?: VariableResolvedDataType): Promise<Variable> {
    const held = await this.#held(token, type);

    if (held !== null) {
      return held;
    }

    const listed = await this.#listed(token, type);
    let imported = this.#imports.get(listed.key);

    if (imported === undefined) {
      imported = figma.variables.importVariableByKeyAsync(listed.key).then((variable) => {
        this.lookup.remember(variable);

        return variable;
      });
      this.#imports.set(listed.key, imported);
    }

    return ofType(await imported, token, type);
  }

  /** As variable, without importing: a library variable is only found (a dry run's check). */
  async find(token: string, type?: VariableResolvedDataType): Promise<VariableRef> {
    const held = await this.#held(token, type);

    if (held !== null) {
      return held;
    }

    const listed = await this.#listed(token, type);

    return ofType(
      {
        id: `library:${listed.key}`,
        name: listed.name,
        resolvedType: listed.resolvedType,
      },
      token,
      type,
    );
  }

  /** The file's (or a used library's) variable with the name, or null when only the enabled libraries may have it. */
  async #held(token: string, type: VariableResolvedDataType | undefined): Promise<Variable | null> {
    if (!this.#variables.has(token)) {
      await this.#lookOnOtherPages();
    }

    const entry = this.#variables.get(token);

    if (entry === undefined) {
      return null;
    }

    const variable = await this.lookup.variable(entry.id);

    if (variable === null) {
      throw new WriteError(`${token} names a variable Figma cannot reach now.`, "Enable its library, or use a value.");
    }

    return ofType(variable, token, type);
  }

  /** An enabled library's variable with the name, or an error naming close tokens. */
  async #listed(token: string, type: VariableResolvedDataType | undefined): Promise<LibraryVariable> {
    this.#libraries ??= libraryVariablesByToken();

    const listed = (await this.#libraries).get(token);

    if (listed === undefined) {
      const names = [
        ...this.#variables.keys(),
        ...[...this.#styles.keys()].map((key) => key.slice(key.indexOf(" ") + 1)),
      ];

      throw unknownToken(type === "COLOR" ? "paint style or colour variable" : "variable", token, names);
    }

    return listed;
  }

  /** The other pages' tokens, read once and only when a name is missing: loading every page is slow on big files. */
  async #lookOnOtherPages(): Promise<void> {
    this.#otherPages ??= tokensOfOtherPages().then((pages) => {
      for (const tokens of pages) {
        this.#take(tokens);
      }
    });

    await this.#otherPages;
  }

  /** Takes a page's tokens; the current page's style names come first and stay (another page numbers its own). */
  #take(raw: RawTokens): void {
    for (const style of raw.styles) {
      const key = `${style.type} ${styleTokenName(style)}`;

      if (!this.#styles.has(key)) {
        this.#styles.set(key, style.id);
      }

      if (style.type === "TEXT" && !this.#textStyles.has(styleName(style))) {
        this.#textStyles.set(styleName(style), style.id);
      }
    }

    for (const variable of raw.variables) {
      this.#variables.set(variableTokenName(variable), variable);
    }

    for (const [id, variable] of Object.entries(raw.external)) {
      this.#variables.set(variableTokenName(variable), {
        id,
        resolvedType: variable.resolvedType,
      });
    }
  }
}

/** The variable, when it is of the type asked for (any type when none is). */
function ofType<V extends { readonly resolvedType: string }>(
  variable: V,
  token: string,
  type: VariableResolvedDataType | undefined,
): V {
  if (type !== undefined && variable.resolvedType !== type) {
    throw new WriteError(
      `${token} is a ${variable.resolvedType.toLowerCase()} variable: this needs a ${type.toLowerCase()} one.`,
    );
  }

  return variable;
}

function unknownToken(what: string, token: string, candidates: Iterable<string>): WriteError {
  const near = closest(token, candidates);

  return new WriteError(
    `No ${what} is named ${token} in this file or the libraries it uses.`,
    near === null ? "tokens_read lists the file's tokens." : `Did you mean ${near}?`,
  );
}
