import { type OperationInput, type OperationOutput, type RawTokens, unwrapVar } from "@pixelwright/core";
import { LIBRARY_BUDGET_MS } from "../constants/plugin.ts";
import { errorMessage } from "../utils/error-message.ts";
import { plain } from "../utils/plain.ts";
import { pageOf, requireNode } from "./nodes.ts";
import { localStyles, numbered, numberingStyles, styleOf } from "./styles.ts";
import { aliasesIn, loaded, usedUnder } from "./used-tokens.ts";

/**
 * The file's tokens as Figma keeps them: every local collection with its modes and every variable's value per mode,
 * aliases kept; every variable an alias points at outside the file (a library's), with its collection; the local
 * styles; the styles and variables the layers in `within` (or the current page) use; and, when asked, the enabled
 * libraries' variables by name (their values would need an import, which writes to the file).
 */
export async function variables({
  libraries,
  used,
  within,
}: OperationInput<"variables">): Promise<OperationOutput<"variables">> {
  const raw: RawTokens = {
    collections: (await figma.variables.getLocalVariableCollectionsAsync()).map(collectionOf),
    variables: (await figma.variables.getLocalVariablesAsync()).map(variableOf),
    external: {},
    styles: await localStyles(),
  };

  await addVariables(
    raw,
    raw.variables.flatMap((variable) => aliasesIn(variable.valuesByMode)),
  );

  if (used) {
    const root = within === undefined ? figma.currentPage : await requireNode(within);
    const page = root.type === "PAGE" ? null : pageOf(root);

    await addUsed(raw, root);
    await addPaintCss(raw, root);
    // A library style may share a name with one of the file's or another library's: numbered again among the page's,
    // as every reader numbers them, so a part of the page reads the same names as the whole page.
    raw.styles = numbered(raw.styles, page === null ? [] : await numberingStyles([page]));
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

function variableOf(variable: Variable): RawTokens["variables"][number] {
  return {
    id: variable.id,
    name: variable.name,
    collectionId: variable.variableCollectionId,
    resolvedType: variable.resolvedType,
    ...(variable.description === "" || variable.description === undefined ? {} : { description: variable.description }),
    scopes: [...(variable.scopes ?? [])],
    ...codeSyntaxOf(variable),
    valuesByMode: plain<Record<string, unknown>>(variable.valuesByMode),
  };
}

/**
 * Adds the variables with these ids that the tokens do not hold yet, each with its collection and every variable its
 * values point at, so every var() the tokens write is defined. A variable whose collection cannot be read is named in
 * `external` only.
 */
async function addVariables(raw: RawTokens, ids: readonly string[]): Promise<void> {
  const knownVariables = new Set(raw.variables.map((variable) => variable.id));
  const knownCollections = new Set(raw.collections.map((collection) => collection.id));
  const queue = [...ids];

  for (let index = 0; index < queue.length; index++) {
    const id = queue[index] as string;

    if (knownVariables.has(id) || raw.external[id] !== undefined) {
      continue;
    }

    const variable = await figma.variables.getVariableByIdAsync(id);

    if (variable === null) {
      continue;
    }

    if (!knownCollections.has(variable.variableCollectionId)) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);

      if (collection === null) {
        raw.external[id] = {
          name: variable.name,
          collection: "",
          resolvedType: variable.resolvedType,
          ...codeSyntaxOf(variable),
        };
        continue;
      }

      raw.collections.push(collectionOf(collection));
      knownCollections.add(collection.id);
    }

    const entry = variableOf(variable);

    raw.variables.push(entry);
    knownVariables.add(id);
    queue.push(...aliasesIn(entry.valuesByMode));
  }
}

/**
 * Each gradient or layered paint style's CSS, from the first layer under `root` it fills: core writes only single solid
 * paint styles itself, and Figma writes the rest for a layer (getCSSAsync's background).
 */
async function addPaintCss(raw: RawTokens, root: BaseNode): Promise<void> {
  const wanted = new Map(
    raw.styles
      .filter((style) => style.type === "PAINT" && style.css === undefined && gradient(style.paints ?? []))
      .map((style) => [style.id, style]),
  );

  if (wanted.size === 0 || !("findAll" in root)) {
    return;
  }

  const filled = root.findAll(
    (layer) => "fillStyleId" in layer && typeof layer.fillStyleId === "string" && wanted.has(layer.fillStyleId),
  );

  for (const layer of filled) {
    const style = wanted.get((layer as SceneNode & { fillStyleId: string }).fillStyleId);

    if (style !== undefined && style.css === undefined && "getCSSAsync" in layer) {
      const css = unwrapVar((await layer.getCSSAsync()).background);

      if (css !== undefined) {
        style.css = css;
      }
    }
  }
}

/** Whether a paint style draws a gradient: only that is worth asking Figma for CSS (an image has none). */
function gradient(paints: readonly { type: string; visible?: boolean | undefined }[]): boolean {
  return paints.some((paint) => paint.visible !== false && paint.type.startsWith("GRADIENT_"));
}

/** The styles and variables the layers under `root` use and the file does not define (a team library's). */
async function addUsed(raw: RawTokens, root: BaseNode): Promise<void> {
  await loaded(root);

  const { styleIds, variableIds } = usedUnder(root);
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

  await addVariables(raw, variableIds);
}

/**
 * The enabled libraries' variable collections and their variables, within LIBRARY_BUDGET_MS so the local tokens still
 * come back in time; a failure or the budget running out is said in libraryError, never thrown.
 */
async function libraryCatalogue(): Promise<Pick<RawTokens, "library" | "libraryError">> {
  const library: NonNullable<RawTokens["library"]> = [];
  const started = Date.now();

  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

    for (const collection of collections) {
      if (Date.now() - started > LIBRARY_BUDGET_MS) {
        return {
          library,
          libraryError: `The libraries took too long: read ${library.length} of ${collections.length} collections.`,
        };
      }

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
    return {
      ...(library.length === 0 ? {} : { library }),
      libraryError: `The libraries could not be read: ${errorMessage(error)}`,
    };
  }
}

function codeSyntaxOf(variable: Pick<Variable, "codeSyntax">): { codeSyntax?: Record<string, string> } {
  const entries = Object.entries(variable.codeSyntax ?? {});

  return entries.length === 0 ? {} : { codeSyntax: Object.fromEntries(entries) };
}
