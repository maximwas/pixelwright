import { InjectionToken, inject, injectable } from "@needle-di/core";
import { Closest } from "@/core/kernel/names/closest.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { FILE_TOKENS } from "@/plugin/adapters/figma/variables/file-tokens.ts";
import { LIBRARY_CATALOGUE } from "@/plugin/adapters/figma/variables/library-catalogue.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TOKEN_KIND, TOKEN_TEXT } from "@/plugin/operations/apply/apply.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

type Modes = Readonly<Record<string, string>>;

/**
 * A variable as the index holds it, with its collection's name and id. A library one has its key however it was found,
 * so it is one entry (FIX-090A2); one the file lacks yet, from the catalogue, is imported by it.
 */
interface Entry {
  readonly id: string;
  readonly resolvedType: string;
  readonly key?: string | undefined;
  readonly inFile: boolean;
  readonly collection: string;
  readonly collectionId?: string | undefined;
}

/**
 * Where a token is bound: its layer and the layers above it (a dry run's stand-in carries the modes its XML sets), and
 * the modes the element's own XML sets, by collection and mode: a name in any case or the slug design_read writes.
 */
export interface TokenPlace {
  readonly layer: TypedLayer | null;
  readonly modes?: Modes | undefined;
}

/** One step up from a token's element: the modes the call's XML sets there, by collection name, and Figma's, by id. */
interface ModeLevel {
  readonly xml: Modes | undefined;
  readonly explicit: Modes | undefined;
}

export type StyleKind = typeof TOKEN_KIND.paint | typeof TOKEN_KIND.effect | typeof TOKEN_KIND.text;

/**
 * Tokens by the CSS names design_read gives them (T-135, P-097): the file's styles and variables and the library ones
 * the current page uses; a name it lacks is looked for once on the other pages, then among the enabled libraries'
 * variables. design_apply binds tokens, never makes them: an unknown one is an error with the near name. Names only,
 * no style's CSS (m:54e0e1cc: getCSSAsync hung the plugin). One call's index: start() empties it. A CSS name has no
 * collection, so several variables can share one (FIX-090A): it binds the one whose collection's mode is set on the
 * element, else on its nearest layer up that sets a mode of one of theirs (the call's XML first, then Figma's); none
 * there, or several, is refused, on dry and real runs alike (m:f66aed65).
 */
@injectable()
export class TokenIndex {
  readonly #files;
  readonly #catalogue;
  readonly #names;
  readonly #lookup;
  readonly #closest = new Closest();
  readonly #styles = new Map<string, string>();
  readonly #variables = new Map<string, Entry[]>();
  readonly #xml = new Map<string, Modes>();
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

  /** A new call: what the last one read is gone, the file may have changed since; its existing layers' XML modes kept. */
  start(deadline: number, changes: readonly ApplyChangeData[] = []): void {
    this.#styles.clear();
    this.#variables.clear();
    this.#xml.clear();

    for (const { id, props } of changes) {
      if (id !== null && props.modes !== undefined) {
        this.#xml.set(id, props.modes);
      }
    }

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
  async variable(
    token: string,
    type: string,
    place: TokenPlace = { layer: null },
  ): Promise<Variable> {
    const entry = await this.#entry(token, type, place);

    if (entry.inFile || entry.key === undefined) {
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
  async check(
    token: string,
    type: string,
    place: TokenPlace = { layer: null },
  ): Promise<void> {
    await this.#entry(token, type, place);
  }

  /** The variable's entry, of the type asked for. */
  async #entry(
    token: string,
    type: string,
    place: TokenPlace,
  ): Promise<Entry> {
    await this.#currentPage();

    if (!this.#variables.has(token)) {
      await this.#otherPages();
    }

    if (!this.#variables.has(token)) {
      this.#library ??= this.#readLibrary();

      await this.#library;
    }

    const entries = this.#variables.get(token) ?? [];
    const entry = entries.length > 1 ? await this.#chosen(token, entries, place) : entries[0];

    if (entry === undefined) {
      throw this.#unknown(token, type);
    }

    if (entry.resolvedType !== type) {
      throw new WriteError(TOKEN_TEXT.wrongType(token, entry.resolvedType, type));
    }

    return entry;
  }

  /** Of the variables a name names, the one whose collection's mode is set nearest; none or several there throws. */
  async #chosen(
    token: string,
    entries: readonly Entry[],
    place: TokenPlace,
  ): Promise<Entry> {
    const held = await Promise.all(entries.map(async (entry) => await this.#withCollection(entry)));

    for (const level of this.#levels(place)) {
      const set = held.filter((entry) => this.#sets(level, entry));
      const [one] = set;
      const named = this.#collections(set);

      if (named.length > 1) {
        throw new WriteError(
          TOKEN_TEXT.bothSet(token, held.length, this.#collections(held), named),
          TOKEN_TEXT.bothSetHint(named.map((name) => this.#names.attribute(name))),
        );
      }

      // Two variables of one collection: no mode tells them apart.
      if (set.length > 1) {
        break;
      }

      if (one !== undefined) {
        return one;
      }
    }

    const collections = this.#collections(held);

    throw new WriteError(
      TOKEN_TEXT.shared(token, held.length, collections),
      TOKEN_TEXT.sharedHint(collections.map((name) => this.#names.attribute(name))),
    );
  }

  /** Each collection the variables are in, once. */
  #collections(entries: readonly Entry[]): string[] {
    return [...new Set(entries.map(({ collection }) => collection))];
  }

  /** A library variable the page uses comes with its collection's name only: the id is the variable's. */
  async #withCollection(entry: Entry): Promise<Entry> {
    if (entry.collectionId !== undefined || !entry.inFile) {
      return entry;
    }

    return { ...entry, collectionId: (await this.#lookup.variable(entry.id))?.variableCollectionId };
  }

  /** The element's own XML modes, then each layer from its own up: what the call's XML sets there, and Figma's. */
  #levels({ layer, modes }: TokenPlace): ModeLevel[] {
    const levels: ModeLevel[] = [{ xml: modes, explicit: undefined }];

    for (let up: TypedLayer | null | undefined = layer; up !== null && up !== undefined; up = up.parent) {
      levels.push({
        xml: up.modes ?? ("id" in up && typeof up.id === "string" ? this.#xml.get(up.id) : undefined),
        explicit: "explicitVariableModes" in up ? (up as FrameNode).explicitVariableModes : undefined,
      });
    }

    return levels;
  }

  /** Whether the level sets a mode of the variable's collection: the XML's word wins, and an empty one clears it there. */
  #sets(level: ModeLevel, entry: Entry): boolean {
    const key = Object.keys(level.xml ?? {}).find((name) => this.#means(entry.collection, name));

    if (key !== undefined) {
      return (level.xml?.[key] ?? "").trim() !== "";
    }

    return entry.collectionId !== undefined && level.explicit?.[entry.collectionId] !== undefined;
  }

  /** Whether an XML key names the collection: its name in any case, or its slug, trimmed (as ModeStep reads it). */
  #means(collection: string, key: string): boolean {
    const trimmed = key.trim();

    return collection.toLowerCase() === trimmed.toLowerCase() || this.#names.attribute(collection) === trimmed;
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

    for (const { collection, variables } of library) {
      for (const { name, key, resolvedType } of variables) {
        this.#keep(this.#names.token(name), { id: key, resolvedType, key, inFile: false, collection });
      }
    }
  }

  /** Takes pages' tokens; the first page's style names stay (another page numbers its own). */
  async #read(reads: readonly (RawTokens | Promise<RawTokens>)[]): Promise<void> {
    for (const raw of await Promise.all(reads)) {
      const collections = new Map(raw.collections.map(({ id, name }) => [id, name]));

      for (const style of raw.styles) {
        const key = TOKEN_TEXT.key(style.type, this.#names.style(style));

        if (!this.#styles.has(key)) {
          this.#styles.set(key, style.id);
        }
      }

      for (const { id, resolvedType, collectionId, key, ...named } of raw.variables) {
        this.#keep(this.#names.variable(named), {
          id,
          resolvedType,
          key,
          inFile: true,
          collection: collections.get(collectionId) ?? "",
          collectionId,
        });
      }

      for (const [id, variable] of Object.entries(raw.external)) {
        this.#keep(this.#names.variable(variable), {
          id,
          resolvedType: variable.resolvedType,
          key: variable.key,
          inFile: true,
          collection: variable.collection,
        });
      }
    }
  }

  /** Every variable a name names, each once: pages read the file's own again, the catalogue a library one they use. */
  #keep(token: string, entry: Entry): void {
    const kept = this.#variables.get(token) ?? [];
    const identity = entry.key ?? entry.id;

    if (!kept.some((held) => (held.key ?? held.id) === identity)) {
      this.#variables.set(token, [...kept, entry]);
    }
  }

  /** A token no one has: the near one, else where the file's tokens are listed. */
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
