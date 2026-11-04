import * as zod from "zod/mini";
import { LIBRARY_FILES, WRITTEN_STORE } from "@/server/app/stores/stores.constants.ts";
import { ComponentEntrySchema } from "@/shared/ops/components/components.schema.ts";

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
