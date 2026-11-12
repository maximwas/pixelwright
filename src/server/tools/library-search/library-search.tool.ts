import { inject, injectable } from "@needle-di/core";
import Fuse from "fuse.js";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { LIBRARY_STORE, type StoredLibrary } from "@/server/app/stores/library-store.ts";
import { LIBRARY_FILES } from "@/server/app/stores/stores.constants.ts";
import type { LibraryFile } from "@/server/app/stores/stores.schema.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import {
  LIBRARY_SEARCH,
  LIBRARY_SEARCH_KEY,
  LIBRARY_SEARCH_TEXT,
} from "@/server/tools/library-search/library-search.constants.ts";
import {
  type FoundComponent,
  type LibrarySearchInput,
  LibrarySearchInputSchema,
  type LibrarySearchOutput,
} from "@/server/tools/library-search/library-search.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { COMPONENTS, COMPONENTS_SCOPE } from "@/shared/ops/components/components.constants.ts";
import { componentsOp } from "@/shared/ops/components/components.manifest.ts";

/** What a save adds to the answer: the library saved, and what was left out of it. */
interface Saving {
  readonly saved: NonNullable<LibrarySearchOutput["saved"]>;
  readonly notes: string[];
}

/**
 * library_search (T-193): with save, the file's own published components as the components op lists them (scope
 * local, its most) saved as the file's library in the channel's home; with query, every saved library searched by
 * words in any order, a typo too (Fuse.js extended search over the name and one key of all the words, m:87640ec1).
 * Nothing is saved unasked: the bridge never works on its own.
 */
@injectable()
export class LibrarySearchTool extends Tool<LibrarySearchInput, LibrarySearchOutput> {
  protected readonly input = LibrarySearchInputSchema;
  readonly #session;
  readonly #link;
  readonly #store;
  readonly #clock;

  constructor(
    session = inject(PLUGIN_SESSION),
    link = inject(PLUGIN_LINK),
    store = inject(LIBRARY_STORE),
    clock = inject(CLOCK),
  ) {
    super();
    this.#session = session;
    this.#link = link;
    this.#store = store;
    this.#clock = clock;
  }

  protected async run({ query, save, limit }: LibrarySearchInput): Promise<LibrarySearchOutput> {
    const saving = save ? await this.#save() : undefined;
    const { libraries, unreadable } = this.#store.read();
    const found = query === undefined ? undefined : this.#search(libraries, query);
    const notes = [
      ...(saving?.notes ?? []),
      ...unreadable.map((path) => LIBRARY_SEARCH_TEXT.unreadable(path)),
      ...(libraries.length === 0 ? [LIBRARY_SEARCH_TEXT.noLibrary] : []),
    ];

    return {
      ...(found === undefined ? {} : { components: found.slice(0, limit), more: found.length > limit }),
      ...(saving === undefined ? {} : { saved: saving.saved }),
      libraries: libraries.map(({ path, library }) => ({
        name: library.name,
        components: library.components.length,
        savedAt: library.savedAt,
        path,
      })),
      ...(notes.length === 0 ? {} : { notes }),
    };
  }

  /** The file's own components, less those Figma does not publish, saved as its library. */
  async #save(): Promise<Saving> {
    const answer = await this.#session.run(componentsOp, {
      scope: COMPONENTS_SCOPE.local,
      limit: COMPONENTS.maxLimit,
      links: false,
    });
    const file = this.#link.files().find(({ session }) => session === this.#session.id);

    if (file === undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, LIBRARY_SEARCH_TEXT.fileGone);
    }

    const library: LibraryFile = {
      pixelwrightLibrary: LIBRARY_FILES.version,
      name: file.name,
      key: file.key,
      savedAt: new Date(this.#clock.now()).toISOString(),
      components: answer.components
        .filter(({ name }) => !LIBRARY_SEARCH.hidden.test(name))
        .map(({ key, type, name, page, description, properties }) => ({
          key,
          type,
          name,
          page,
          ...(description === undefined ? {} : { description }),
          properties,
        })),
    };
    const path = this.#store.write(library);

    return {
      saved: { library: library.name, path, components: library.components.length },
      notes: [
        ...(answer.more ? [LIBRARY_SEARCH_TEXT.cut(COMPONENTS.maxLimit, library.name)] : []),
        ...(answer.pagesNotRead ?? []).map(({ name, error }) => LIBRARY_SEARCH_TEXT.pageNotRead(name, error)),
      ],
    };
  }

  /** The saved components whose name, description, page or variants hold every word of the query, best first. */
  #search(libraries: readonly StoredLibrary[], query: string): FoundComponent[] {
    const components: FoundComponent[] = libraries.flatMap(({ library }) =>
      library.components.map(({ key, ...component }) => ({
        library: library.name,
        component: LIBRARY_SEARCH.componentKey(key),
        ...component,
      })),
    );
    // Fuse matches every word of an extended query within one key, so one key holds all the words a component has.
    const fuse = new Fuse(components, {
      keys: [
        { name: LIBRARY_SEARCH_KEY.name, weight: LIBRARY_SEARCH.nameWeight },
        { name: LIBRARY_SEARCH_KEY.words, getFn: (component) => this.#words(component) },
      ],
      useExtendedSearch: true,
      ignoreLocation: true,
      threshold: LIBRARY_SEARCH.threshold,
    });

    return fuse.search(query).map(({ item }) => item);
  }

  /** A component's words: its name, description and page, its properties' names and options. */
  #words({ name, description, page, properties }: FoundComponent): string {
    const variants = Object.entries(properties).flatMap(([property, { options }]) => [property, ...(options ?? [])]);

    return [name, description, page, ...variants]
      .filter((word) => word !== undefined && word !== null)
      .join(LIBRARY_SEARCH.wordSeparator);
  }
}
