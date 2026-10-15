import * as z from "zod";
import { SnapshotSchema } from "../../schemas/snapshot.ts";
import { RawTokensSchema } from "../../tokens/raw-tokens.ts";

/** The format baseline files are written in now. */
export const BASELINE_FORMAT = 1;

const NamedSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/** A baseline as the project keeps it: a layer's read, and the values of the tokens it uses in every mode. */
export const BaselineFileSchema = z.object({
  pixelwrightBaseline: z.literal(BASELINE_FORMAT),
  /** The same as the file's name. */
  name: z.string(),
  /** When the layer was read: an ISO time. */
  capturedAt: z.string(),
  /** The versions that read it. */
  by: z.object({
    server: z.string(),
    plugin: z.string().nullable(),
  }),
  file: z.object({
    name: z.string(),
    key: z.string().nullable(),
  }),
  page: NamedSchema.nullable(),
  node: NamedSchema.extend({ type: z.string() }),
  /** The project's files built from the layer, relative to the project. */
  code: z.array(z.string()),
  /** The Figma version saved with it, once version_save records one. */
  version: z
    .object({
      id: z.string().nullable(),
      title: z.string(),
      savedAt: z.string(),
    })
    .nullable(),
  snapshot: SnapshotSchema,
  /** The tokens the snapshot uses, with every mode; null when they could not be read. */
  tokens: RawTokensSchema.nullable(),
});

export type BaselineFile = z.output<typeof BaselineFileSchema>;
