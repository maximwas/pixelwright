import { BridgeError } from "@pixelwright/core";
import Fuse from "fuse.js";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { LIBRARY_COMPONENTS_MAX, SEARCH_THRESHOLD } from "./constants.ts";
import { type LibraryFile, readLibraries, type StoredLibrary, writeLibrary } from "./library-store.ts";
import type { LibrarySearchInputSchema, LibrarySearchOutputSchema } from "./schemas.ts";

type Input = Omit<z.output<typeof LibrarySearchInputSchema>, "file"> & { file?: string };
type Output = z.output<typeof LibrarySearchOutputSchema>;
type Found = NonNullable<Output["components"]>[number];

const NO_LIBRARY =
  "No library is saved yet: open the library file in Figma Desktop with the Pixelwright plugin and call library_search {save: true} there. Its components can then be found from any file.";

/**
 * Saves the file's own published components as a library when asked, then finds the query's words in every saved
 * library: each found component with the key design_apply makes an instance of.
 */
export async function searchLibraries(plugin: PluginClient, input: Input, folder: string): Promise<Output> {
  const saving = input.save ? await saveLibrary(plugin, input.file, folder) : undefined;
  const { libraries, problems } = await readLibraries(folder);
  const found = input.query === undefined ? undefined : search(libraries, input.query);
  const notes = [...(saving?.notes ?? []), ...problems, ...(libraries.length === 0 ? [NO_LIBRARY] : [])];

  return {
    ...(found === undefined
      ? {}
      : {
          components: found.slice(0, input.limit),
          more: found.length > input.limit,
        }),
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

/** The file's own components, less those Figma does not publish (named with a leading . or _), saved as its library. */
async function saveLibrary(plugin: PluginClient, file: string | undefined, folder: string) {
  const session = plugin.session(file);
  const answer = await session.run("components", {
    scope: "local",
    limit: LIBRARY_COMPONENTS_MAX,
  });
  const figmaFile = session.info()?.file;

  if (figmaFile === undefined) {
    throw new BridgeError(
      "OP_FAILED",
      "The plugin left the file before its library was saved: open it and save again.",
    );
  }

  const library: LibraryFile = {
    pixelwrightLibrary: 1,
    name: figmaFile.name,
    key: figmaFile.key,
    savedAt: new Date().toISOString(),
    components: answer.components
      .filter(({ name }) => !/^[._]/.test(name))
      .map(({ key, type, name, page, description, properties }) => ({
        key,
        type,
        name,
        page,
        ...(description === undefined ? {} : { description }),
        properties,
      })),
  };
  const path = await writeLibrary(folder, library);

  return {
    saved: {
      library: library.name,
      path,
      components: library.components.length,
    },
    notes: [
      ...(answer.more
        ? [
            `Only the first ${LIBRARY_COMPONENTS_MAX} components of ${library.name} are saved: the plugin lists no more.`,
          ]
        : []),
      ...(answer.pagesNotRead ?? []).map(
        ({ name, error }) => `The page ${name} could not be read (${error}): its components are not saved.`,
      ),
    ],
  };
}

/** The saved components whose name, description, page or variants hold every word of the query, best first. */
function search(libraries: readonly StoredLibrary[], query: string): Found[] {
  const components: Found[] = libraries.flatMap(({ library }) =>
    library.components.map(({ key, ...component }) => ({
      library: library.name,
      component: `key:${key}`,
      ...component,
    })),
  );
  // Fuse matches every word of an extended query within one key, so one key holds all the words a component has.
  const words = ({ name, description, page, properties }: Found) =>
    [
      name,
      description,
      page,
      ...Object.entries(properties).flatMap(([prop, { options }]) => [prop, ...(options ?? [])]),
    ]
      .filter((word) => word !== undefined && word !== null)
      .join(" ");

  return new Fuse(components, {
    keys: [
      {
        name: "name",
        weight: 3,
      },
      {
        name: "words",
        getFn: words,
      },
    ],
    useExtendedSearch: true,
    ignoreLocation: true,
    threshold: SEARCH_THRESHOLD,
  })
    .search(query)
    .map(({ item }) => item);
}
