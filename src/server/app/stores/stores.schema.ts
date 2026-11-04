import * as zod from "zod/mini";
import { BASELINE_FILES, LIBRARY_FILES, WRITTEN_STORE } from "@/server/app/stores/stores.constants.ts";
import { ComponentEntrySchema } from "@/shared/ops/components/components.schema.ts";
import { RawTokensSchema } from "@/shared/ops/variables/variables.schema.ts";
import { ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

/** latest.json: npm's last answer, when it came (ms), and the version whose banner the user closed. */
const LatestSchema = zod.object({
  version: zod.string(),
  checkedAt: zod.number(),
  dismissed: zod.optional(zod.string()),
});

export type Latest = zod.output<typeof LatestSchema>;

/** latest.json as read: null when there is none yet, or it is not one. */
export const KeptLatestSchema = zod.nullable(LatestSchema);

/** written-files.json (S-101): the layers each written file shows, by the SHA-1 of its bytes, the newest last. */
export const WrittenFilesSchema = zod.object({
  version: zod.literal(WRITTEN_STORE.version),
  files: zod.record(zod.string(), zod.array(zod.string())),
});

/** A published component or set as a library's catalogue keeps it (T-193). */
export const LibraryComponentSchema = zod.pick(ComponentEntrySchema, {
  key: true,
  type: true,
  name: true,
  page: true,
  description: true,
  properties: true,
});

/** A library file's catalogue (T-193): its name in Figma, figma.fileKey (null: only private plugins get one), when. */
const LibraryFileSchema = zod.object({
  pixelwrightLibrary: zod.literal(LIBRARY_FILES.version),
  name: zod.string(),
  key: zod.nullable(zod.string()),
  savedAt: zod.iso.datetime(),
  components: zod.array(LibraryComponentSchema),
});

export type LibraryFile = zod.output<typeof LibraryFileSchema>;

/** A catalogue as read: null when it cannot be read, or is not one. */
export const KeptLibrarySchema = zod.nullable(LibraryFileSchema);

/** A layer or a page by id and name. */
export const NamedSchema = zod.object({ id: zod.string(), name: zod.string() });

/** The layer a baseline keeps. */
export const BaselineNodeSchema = zod.extend(NamedSchema, { type: zod.string() });

/** A baseline's name as the tools take it: lowercase words joined by hyphens, 1 to 64 characters. */
export const BaselineNameSchema = zod
  .string()
  .check(zod.minLength(BASELINE_FILES.minName), zod.maxLength(BASELINE_FILES.maxName), zod.regex(BASELINE_FILES.name));

/** The Figma version 0.7.0's version_save recorded with a baseline. */
export const BaselineVersionSchema = zod.object({
  id: zod.nullable(zod.string()),
  title: zod.string(),
  savedAt: zod.string(),
});

/** The Figma file a baseline came from: its name, and its key when Figma gives one. */
export const BaselineFigmaFileSchema = zod.object({ name: zod.string(), key: zod.nullable(zod.string()) });

/** A baseline file, format 1 as 0.7.0 wrote it (K-058, D-33): its header, then a layer's read and the tokens it uses. */
export const BaselineFileSchema = zod.object({
  pixelwrightBaseline: zod.literal(BASELINE_FILES.format),
  /** The file's name, which wins when they differ. */
  name: zod.string(),
  /** When the layer was read: an ISO time. */
  capturedAt: zod.string(),
  /** The versions that read it. */
  by: zod.object({ server: zod.string(), plugin: zod.nullable(zod.string()) }),
  file: BaselineFigmaFileSchema,
  page: zod.nullable(NamedSchema),
  node: BaselineNodeSchema,
  /** The project's files built from the layer, relative to the project. */
  code: zod.array(zod.string()),
  /** The Figma version 0.7.0's version_save recorded with it. */
  version: zod.nullable(BaselineVersionSchema),
  /** A read model; a 0.7.0 snapshot has no header and reads as a design model. */
  snapshot: ReadModelSchema,
  /** The tokens the read uses, with every mode; null when they could not be read. */
  tokens: zod.nullable(RawTokensSchema),
});

export type BaselineFile = zod.output<typeof BaselineFileSchema>;
