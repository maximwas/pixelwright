import * as zod from "zod/mini";
import { WRITTEN_STORE } from "@/server/app/stores/stores.constants.ts";

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
