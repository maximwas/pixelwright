import type { OperationInput, OperationOutput, RawTokens } from "@pixelwright/core";
import { errorMessage } from "../utils/error-message.ts";
import { plain } from "../utils/plain.ts";
import { localStyles } from "./styles.ts";

/**
 * The file's tokens as Figma keeps them: every local collection with its modes, every variable's value per mode
 * (aliases kept, those pointing outside the file resolved by id), the local styles, and, when asked, the enabled
 * libraries' variables by name (their values would need an import, which writes to the file).
 */
export async function variables({ libraries }: OperationInput<"variables">): Promise<OperationOutput<"variables">> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const locals = await figma.variables.getLocalVariablesAsync();
  const local = new Set(locals.map((variable) => variable.id));
  const external: RawTokens["external"] = {};
  const entries: RawTokens["variables"] = [];

  for (const variable of locals) {
    const valuesByMode = plain<Record<string, unknown>>(variable.valuesByMode);

    for (const value of Object.values(valuesByMode)) {
      const id = aliasOf(value);

      if (id !== null && !local.has(id) && external[id] === undefined) {
        const target = await figma.variables.getVariableByIdAsync(id);

        if (target !== null) {
          const collection = await figma.variables.getVariableCollectionByIdAsync(target.variableCollectionId);

          external[id] = {
            name: target.name,
            collection: collection?.name ?? "",
            resolvedType: target.resolvedType,
            ...codeSyntaxOf(target),
          };
        }
      }
    }

    entries.push({
      id: variable.id,
      name: variable.name,
      collectionId: variable.variableCollectionId,
      resolvedType: variable.resolvedType,
      ...(variable.description === "" ? {} : { description: variable.description }),
      scopes: [...variable.scopes],
      ...codeSyntaxOf(variable),
      valuesByMode,
    });
  }

  return {
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      remote: collection.remote,
      defaultModeId: collection.defaultModeId,
      modes: collection.modes.map(({ modeId, name }) => ({
        modeId,
        name,
      })),
    })),
    variables: entries,
    external,
    styles: await localStyles(),
    ...(libraries ? await libraryCatalogue() : {}),
  };
}

/** The enabled libraries' variable collections and their variables; a failure (offline, no access) is said, not thrown. */
async function libraryCatalogue(): Promise<Pick<RawTokens, "library" | "libraryError">> {
  try {
    const library: NonNullable<RawTokens["library"]> = [];

    for (const collection of await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()) {
      const found = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);

      library.push({
        libraryName: collection.libraryName,
        collection: collection.name,
        key: collection.key,
        variables: found.map(({ key, name, resolvedType }) => ({
          key,
          name,
          resolvedType,
        })),
      });
    }

    return { library };
  } catch (error) {
    return { libraryError: `The libraries could not be read: ${errorMessage(error)}` };
  }
}

function aliasOf(value: unknown): string | null {
  return typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "VARIABLE_ALIAS" &&
    "id" in value
    ? String(value.id)
    : null;
}

function codeSyntaxOf(variable: Pick<Variable, "codeSyntax">): { codeSyntax?: Record<string, string> } {
  const entries = Object.entries(variable.codeSyntax ?? {});

  return entries.length === 0 ? {} : { codeSyntax: Object.fromEntries(entries) };
}
