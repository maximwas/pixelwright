import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { LibraryComponentSchema } from "@/server/app/stores/stores.schema.ts";
import { LIBRARY_SEARCH, LIBRARY_SEARCH_FIELD } from "@/server/tools/library-search/library-search.constants.ts";

export const LibrarySearchInputSchema = zod.strictObject({
  query: zod
    .exactOptional(zod.string().check(zod.minLength(LIBRARY_SEARCH.minChars), zod.maxLength(LIBRARY_SEARCH.maxChars)))
    .check(zod.describe(LIBRARY_SEARCH_FIELD.query)),
  save: zod._default(zod.boolean(), false).check(zod.describe(LIBRARY_SEARCH_FIELD.save)),
  file: FileInputSchema,
  limit: zod
    ._default(
      zod.int().check(zod.minimum(LIBRARY_SEARCH.minLimit), zod.maximum(LIBRARY_SEARCH.maxLimit)),
      LIBRARY_SEARCH.defaultLimit,
    )
    .check(zod.describe(LIBRARY_SEARCH_FIELD.limit)),
});

/** A component a query found: its library, and the key an instance of it is made from. */
const FoundSchema = zod.extend(zod.omit(LibraryComponentSchema, { key: true }), {
  library: zod.string(),
  component: zod.string().check(zod.describe(LIBRARY_SEARCH_FIELD.component)),
});

export const LibrarySearchOutputSchema = zod.object({
  components: zod.exactOptional(zod.array(FoundSchema)).check(zod.describe(LIBRARY_SEARCH_FIELD.components)),
  more: zod.exactOptional(zod.boolean()),
  saved: zod.exactOptional(zod.object({ library: zod.string(), path: zod.string(), components: zod.int() })),
  libraries: zod
    .array(zod.object({ name: zod.string(), components: zod.int(), savedAt: zod.string(), path: zod.string() }))
    .check(zod.describe(LIBRARY_SEARCH_FIELD.libraries)),
  notes: zod.exactOptional(zod.array(zod.string())),
});

export type LibrarySearchInput = zod.output<typeof LibrarySearchInputSchema>;

export type LibrarySearchOutput = zod.output<typeof LibrarySearchOutputSchema>;

export type FoundComponent = zod.output<typeof FoundSchema>;
