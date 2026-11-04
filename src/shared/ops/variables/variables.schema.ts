import * as zod from "zod/mini";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";
import { StyleSchema } from "@/shared/read-model/read-model.schema.ts";

/**
 * What the variables op reads (T-160, P-125): the file's own tokens; with `used`, also the styles and variables the
 * layers on the current page (or under `within`) use, a team library's among them; with `libraries`, the enabled
 * libraries' variables by name.
 */
export const VariablesOpInputSchema = zod.strictObject({
  libraries: zod.boolean(),
  used: zod.boolean(),
  within: zod.exactOptional(NodeIdSchema),
});

const CodeSyntaxSchema = zod.exactOptional(zod.record(zod.string(), zod.string()));

/** A variable collection with its modes. */
const RawCollectionSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  remote: zod.boolean(),
  defaultModeId: zod.string(),
  modes: zod.array(zod.object({ modeId: zod.string(), name: zod.string() })),
});

/** A variable with its value in every mode: a value, or an alias `{ type: "VARIABLE_ALIAS", id }`. */
const RawVariableSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  collectionId: zod.string(),
  resolvedType: zod.string(),
  description: zod.exactOptional(zod.string()),
  scopes: zod.array(zod.string()),
  codeSyntax: CodeSyntaxSchema,
  valuesByMode: zod.record(zod.string(), zod.unknown()),
});

/** A variable an alias points at whose collection Figma cannot give (a library's): named only. */
const ExternalVariableSchema = zod.object({
  name: zod.string(),
  collection: zod.string(),
  resolvedType: zod.string(),
  codeSyntax: CodeSyntaxSchema,
});

/** An enabled library's variable collection: names and types only, since values need an import (a write). */
export const LibraryCollectionSchema = zod.object({
  libraryName: zod.string(),
  collection: zod.string(),
  key: zod.string(),
  variables: zod.array(zod.object({ name: zod.string(), key: zod.string(), resolvedType: zod.string() })),
});

/** The file's tokens as Figma keeps them (P-098): what the variables op returns and core's token model reads. */
export const RawTokensSchema = zod.object({
  collections: zod.array(RawCollectionSchema),
  variables: zod.array(RawVariableSchema),
  external: zod.record(zod.string(), ExternalVariableSchema),
  styles: zod.array(zod.extend(StyleSchema, { id: zod.string() })),
  library: zod.exactOptional(zod.array(LibraryCollectionSchema)),
  /** Figma's colour profile of the file (LEGACY, SRGB, DISPLAY_P3): a Display P3 file's colours are P3 values. */
  colorProfile: zod.exactOptional(zod.string()),
  /** Why the library catalogue is missing or cut although it was asked for. */
  libraryNote: zod.exactOptional(zod.string()),
});

export type RawTokens = zod.output<typeof RawTokensSchema>;

export type RawCollection = RawTokens["collections"][number];

export type RawVariable = RawTokens["variables"][number];

export type RawStyle = RawTokens["styles"][number];

export type LibraryCatalogue = NonNullable<RawTokens["library"]>;
