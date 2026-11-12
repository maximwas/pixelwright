import { InjectionToken, inject, injectable } from "@needle-di/core";
import { Closest } from "@/core/kernel/names/closest.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { FILE_TOKENS } from "@/plugin/adapters/figma/variables/file-tokens.ts";
import { LIBRARY_CATALOGUE } from "@/plugin/adapters/figma/variables/library-catalogue.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TOKEN_KIND, TOKEN_TEXT } from "@/plugin/operations/apply/apply.constants.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/** A variable as the index holds it; a library one not imported yet has its key. */
interface Entry {
  readonly id: string;
  readonly resolvedType: string;
  readonly key?: string;
}

export type StyleKind = typeof TOKEN_KIND.paint | typeof TOKEN_KIND.effect;

/**
 * Tokens by the CSS names design_read gives them (T-135, P-097): the file's styles and variables and the library ones
 * the current page uses; a name it lacks is looked for once on the other pages, then among the enabled libraries'
 * variables. design_apply binds tokens, never makes them: an unknown one is an error with the near name. Names only,
 * no style's CSS (m:54e0e1cc: getCSSAsync hung the plugin). One call's index: start() empties it.
 */
@injectable()
export class TokenIndex {
  readonly #files;
  readonly #catalogue;
  readonly #names;
  readonly #lookup;
  readonly #closest = new Closest();
  readonly #styles = new Map<string, string>();
  readonly #variables = new Map<string, Entry>();
  readonly #imports = new Map<string, Promise<Variable>>();
  #current: Promise<void> | null = null;
  #others: Promise<void> | null = null;
  #library: Promise<void> | null = null;
  #deadline = 0;

  constructor(
    files = inject(FILE_TOKENS),
    catalogue = inject(LIBRARY_CATALOGUE),
    names = inject(TOKEN_NAMES),
    lookup = inject(NODE_LOOKUP),
  ) {
    this.#files = files;
    this.#catalogue = catalogue;
    this.#names = names;
    this.#lookup = lookup;
  }

  /** A new call: what the last one read is gone, the file may have changed since. */
  start(deadline: number): void {
    this.#styles.clear();
    this.#variables.clear();
    this.#imports.clear();
    this.#current = null;
    this.#others = null;
    this.#library = null;
    this.#deadline = deadline;
  }

  /** A style's id, or null when no style of the kind has the name; a name a variable has is not looked for farther. */
  async style(token: string, kind: StyleKind): Promise<string | null> {
    const key = TOKEN_TEXT.key(kind, token);

    await this.#currentPage();

    if (!this.#styles.has(key) && !this.#variables.has(token)) {
      await this.#otherPages();
    }

    return this.#styles.get(key) ?? null;
  }

  /** The variable of the type, a library's imported into the file (a write) once per call; an error naming near ones. */
  async variable(token: string, type: string): Promise<Variable> {
    const entry = await this.#entry(token, type);

    if (entry.key === undefined) {
      const variable = await this.#lookup.variable(entry.id);

      if (variable === null) {
        throw new WriteError(TOKEN_TEXT.unreachable(token), TOKEN_TEXT.unreachableHint);
      }

      return variable;
    }

    const imported = this.#imports.get(entry.key) ?? this.#catalogue.imported(entry.key);

    this.#imports.set(entry.key, imported);

    return await imported;
  }

  /** As variable, without importing (a dry run's check, and a real run's before anything is written). */
  async check(token: string, type: string): Promise<void> {
    await this.#entry(token, type);
  }

  /** The variable's entry, of the type asked for. */
  async #entry(token: string, type: string): Promise<Entry> {
    await this.#currentPage();

    if (!this.#variables.has(token)) {
      await this.#otherPages();
    }

    if (!this.#variables.has(token)) {
      this.#library ??= this.#readLibrary();

      await this.#library;
    }

    const entry = this.#variables.get(token);

    if (entry === undefined) {
      throw this.#unknown(token, type);
    }

    if (entry.resolvedType !== type) {
      throw new WriteError(TOKEN_TEXT.wrongType(token, entry.resolvedType, type));
    }

    return entry;
  }

  /** The current page's tokens, read once per call. */
  async #currentPage(): Promise<void> {
    this.#current ??= this.#read([this.#files.read({ used: true }, this.#deadline)]);

    await this.#current;
  }

  /** The other pages' tokens, read once and only when a name is missing: loading every page is slow on big files. */
  async #otherPages(): Promise<void> {
    this.#others ??= this.#files.otherPages(this.#deadline).then(async (pages) => await this.#read(pages));

    await this.#others;
  }

  /** The enabled libraries' variables by token name, the file's own and used ones kept first. */
  async #readLibrary(): Promise<void> {
    const { library = [] } = await this.#catalogue.read(this.#deadline);

    for (const { variables } of library) {
      for (const { name, key, resolvedType } of variables) {
        this.#keep(this.#names.token(name), { id: key, resolvedType, key });
      }
    }
  }

  /** Takes pages' tokens; the first page's style names stay (another page numbers its own). */
  async #read(reads: readonly (RawTokens | Promise<RawTokens>)[]): Promise<void> {
    for (const raw of await Promise.all(reads)) {
      for (const style of raw.styles) {
        const key = TOKEN_TEXT.key(style.type, this.#names.style(style));

        if (!this.#styles.has(key)) {
          this.#styles.set(key, style.id);
        }
      }

      for (const variable of raw.variables) {
        this.#keep(this.#names.variable(variable), variable);
      }

      for (const [id, variable] of Object.entries(raw.external)) {
        this.#keep(this.#names.variable(variable), { id, resolvedType: variable.resolvedType });
      }
    }
  }

  #keep(token: string, entry: Entry): void {
    if (!this.#variables.has(token)) {
      this.#variables.set(token, {
        id: entry.id,
        resolvedType: entry.resolvedType,
        ...(entry.key ? { key: entry.key } : {}),
      });
    }
  }

  /** A token no one has: the near one, and where a new one comes from (tokens_apply makes tokens). */
  #unknown(token: string, type: string): WriteError {
    const names = [
      ...this.#variables.keys(),
      ...[...this.#styles.keys()].map((key) => key.slice(key.indexOf(TOKEN_TEXT.keyJoint) + 1)),
    ];
    const near = this.#closest.of(token, names);
    const what = type === TOKEN_KIND.colour ? TOKEN_TEXT.colourWhat : TOKEN_TEXT.variableWhat;

    return new WriteError(TOKEN_TEXT.unknown(what, token), near === null ? TOKEN_TEXT.list : TOKEN_TEXT.near(near));
  }
}

export const TOKEN_INDEX = new InjectionToken<TokenIndex>("TokenIndex");
