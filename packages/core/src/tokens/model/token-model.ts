import { colorSpaceOf } from "../../kernel/color/color-space.ts";
import { tokenName, variableTokenName } from "../../kernel/names.ts";
import { Notes } from "../notes.ts";
import type { RawCollection, RawTokens, RawVariable } from "../raw-tokens.ts";
import { filteredCollections, type TokenFilter } from "../token-filter.ts";
import { noteMissingTargets } from "./missing-targets.ts";
import { modeSelectors } from "./mode-selectors.ts";
import { styleTokens } from "./style-tokens.ts";
import type { TokenCollection, TokenModel, TokenVariable } from "./types.ts";
import { type VariableCssContext, variableCss } from "./variable-css.ts";

/**
 * A file's tokens ready for code: each collection with its modes by name, each variable named the way design_read
 * names it and written as CSS in every mode (an alias as `var(--other)`), and the paint, text and effect styles. What
 * could not be written as asked is in notes.
 */
export function tokenModel(raw: RawTokens, filter: TokenFilter = {}): TokenModel {
  const notes = new Notes();
  const space = colorSpaceOf(raw.colorProfile);
  const context: VariableCssContext = {
    names: tokenNames(raw),
    space,
    notes,
  };
  const drafts = filteredCollections(raw, filter).map((collection) => draftOf(collection, raw.variables, context));
  const selectors = modeSelectors(drafts, notes);
  const collections: TokenCollection[] = drafts.map(({ variables, ...collection }, index) => ({
    ...collection,
    selectors: selectors[index] ?? {},
    variables,
  }));

  noteMissingTargets(collections, raw, context.names, notes);

  const styles = styleTokens(raw.styles, {
    space,
    notes,
  });

  return {
    collections,
    styles,
    ...(raw.library === undefined ? {} : { library: raw.library }),
    notes: notes.list(),
  };
}

/** Every variable's CSS name by id, the file's own and the libraries' its aliases point at. */
function tokenNames(raw: RawTokens): Map<string, string> {
  return new Map([
    ...raw.variables.map((variable) => [variable.id, variableTokenName(variable)] as const),
    ...Object.entries(raw.external).map(([id, variable]) => [id, variableTokenName(variable)] as const),
  ]);
}

/** A collection's modes and variables, before its selectors are known. */
function draftOf(
  collection: RawCollection,
  variables: readonly RawVariable[],
  context: VariableCssContext,
): Omit<TokenCollection, "selectors"> {
  return {
    name: collection.name,
    modes: collection.modes.map(({ name }) => name),
    defaultMode:
      collection.modes.find(({ modeId }) => modeId === collection.defaultModeId)?.name ??
      collection.modes[0]?.name ??
      "",
    variables: variables
      .filter((variable) => variable.collectionId === collection.id)
      .map((variable) => tokenVariable(variable, collection, context)),
  };
}

function tokenVariable(variable: RawVariable, collection: RawCollection, context: VariableCssContext): TokenVariable {
  return {
    name: variable.name,
    token: context.names.get(variable.id) ?? tokenName(variable.name),
    type: variable.resolvedType,
    values: Object.fromEntries(
      collection.modes.map(({ modeId, name }) => [name, variableCss(variable.valuesByMode[modeId], variable, context)]),
    ),
    ...(variable.description === undefined ? {} : { description: variable.description }),
  };
}
