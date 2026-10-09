import * as z from "zod";
import { SnapshotStyleSchema } from "./snapshot.ts";

/** A variable collection with its modes. */
export const RawCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  remote: z.boolean(),
  defaultModeId: z.string(),
  modes: z.array(
    z.object({
      modeId: z.string(),
      name: z.string(),
    }),
  ),
});

/** A variable with its value in every mode: a value, or an alias `{ type: "VARIABLE_ALIAS", id }`. */
export const RawVariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  collectionId: z.string(),
  resolvedType: z.string(),
  description: z.string().optional(),
  scopes: z.array(z.string()),
  codeSyntax: z.record(z.string(), z.string()).optional(),
  valuesByMode: z.record(z.string(), z.unknown()),
});

/** A variable an alias points at that is not one of the file's own (a library's the file uses). */
export const ExternalVariableSchema = z.object({
  name: z.string(),
  collection: z.string(),
  resolvedType: z.string(),
  codeSyntax: z.record(z.string(), z.string()).optional(),
});

/** An enabled library's variable collection: names and types only, values need an import (a write). */
export const LibraryCollectionSchema = z.object({
  libraryName: z.string(),
  collection: z.string(),
  key: z.string(),
  variables: z.array(
    z.object({
      name: z.string(),
      key: z.string(),
      resolvedType: z.string(),
    }),
  ),
});

/** What the `variables` primitive returns: the file's tokens as Figma keeps them. */
export const RawTokensSchema = z.object({
  collections: z.array(RawCollectionSchema),
  variables: z.array(RawVariableSchema),
  external: z.record(z.string(), ExternalVariableSchema),
  styles: z.array(SnapshotStyleSchema.extend({ id: z.string() })),
  library: z.array(LibraryCollectionSchema).optional(),
  /** Why the library catalogue is missing although it was asked for. */
  libraryError: z.string().optional(),
});
