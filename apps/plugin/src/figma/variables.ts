import type { OperationInput, OperationOutput, RawTokens } from "@pixelwright/core";
import { errorMessage } from "../utils/error-message.ts";
import { plain } from "../utils/plain.ts";
import { requireNode } from "./nodes.ts";
import { localStyles, styleOf } from "./styles.ts";

/**
 * The file's tokens as Figma keeps them: every local collection with its modes, every variable's value per mode
 * (aliases kept, those pointing outside the file resolved by id), the local styles, and, when asked, the enabled
 * libraries' variables by name (their values would need an import, which writes to the file).
 */
export async function variables({
  libraries,
  used,
  within,
}: OperationInput<"variables">): Promise<OperationOutput<"variables">> {
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

  const raw: RawTokens = {
    collections: collections.map(collectionOf),
    variables: entries,
    external,
    styles: await localStyles(),
  };

  if (used) {
    await addUsed(raw, within === undefined ? figma.currentPage : await requireNode(within));
  }

  return {
    ...raw,
    ...(libraries ? await libraryCatalogue() : {}),
  };
}

function collectionOf(collection: VariableCollection): RawTokens["collections"][number] {
  return {
    id: collection.id,
    name: collection.name,
    remote: collection.remote,
    defaultModeId: collection.defaultModeId,
    modes: collection.modes.map(({ modeId, name }) => ({
      modeId,
      name,
    })),
  };
}

/**
 * The styles and variables the layers under `root` use and the file does not define (a team library's): each style,
 * and each variable with its collection and every variable its values point at, so the tokens are whole.
 */
async function addUsed(raw: RawTokens, root: BaseNode): Promise<void> {
  if (root.type === "PAGE" && root !== figma.currentPage) {
    await root.loadAsync();
  }

  const styleIds = new Set<string>();
  const variableIds: string[] = [];
  const layers = "findAll" in root ? [root, ...root.findAll(() => true)] : [root];

  for (const layer of layers) {
    usedBy(layer, styleIds, variableIds);
  }

  const knownStyles = new Set(raw.styles.map((style) => style.id));

  for (const id of styleIds) {
    const style = knownStyles.has(id) ? null : await figma.getStyleByIdAsync(id);

    if (style !== null) {
      raw.styles.push({
        id,
        ...styleOf(style),
      });
      knownStyles.add(id);
    }
  }

  const knownVariables = new Set(raw.variables.map((variable) => variable.id));
  const knownCollections = new Set(raw.collections.map((collection) => collection.id));

  for (let index = 0; index < variableIds.length; index++) {
    const id = variableIds[index] as string;
    const variable = knownVariables.has(id) ? null : await figma.variables.getVariableByIdAsync(id);

    if (variable === null) {
      continue;
    }

    knownVariables.add(id);

    if (!knownCollections.has(variable.variableCollectionId)) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);

      if (collection !== null) {
        raw.collections.push(collectionOf(collection));
        knownCollections.add(collection.id);
      }
    }

    const valuesByMode = plain<Record<string, unknown>>(variable.valuesByMode);

    raw.variables.push({
      id,
      name: variable.name,
      collectionId: variable.variableCollectionId,
      resolvedType: variable.resolvedType,
      ...(variable.description === "" || variable.description === undefined
        ? {}
        : { description: variable.description }),
      scopes: [...(variable.scopes ?? [])],
      ...codeSyntaxOf(variable),
      valuesByMode,
    });

    for (const value of Object.values(valuesByMode)) {
      const alias = aliasOf(value);

      if (alias !== null && !knownVariables.has(alias)) {
        variableIds.push(alias);
      }
    }
  }
}

/** The style ids and variable aliases one layer uses: its own, its paints' and effects', its text runs'. */
function usedBy(layer: BaseNode, styleIds: Set<string>, variableIds: string[]): void {
  const record = layer as BaseNode & Record<string, unknown>;

  for (const key of ["fillStyleId", "strokeStyleId", "effectStyleId", "textStyleId"]) {
    const id = record[key];

    if (typeof id === "string" && id !== "") {
      styleIds.add(id);
    }
  }

  if (layer.type === "TEXT" && (layer.fillStyleId === figma.mixed || layer.textStyleId === figma.mixed)) {
    for (const segment of layer.getStyledTextSegments(["fillStyleId", "textStyleId"])) {
      for (const id of [segment.fillStyleId, segment.textStyleId]) {
        if (id !== "") {
          styleIds.add(id);
        }
      }
    }
  }

  const scan = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(scan);
    } else if (typeof value === "object" && value !== null) {
      const alias = aliasOf(value);

      if (alias === null) {
        Object.values(value).forEach(scan);
      } else if (!variableIds.includes(alias)) {
        variableIds.push(alias);
      }
    }
  };

  scan([record.boundVariables, record.fills, record.strokes, record.effects]);
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
