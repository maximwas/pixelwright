import * as zod from "zod/mini";

/** latest.json: npm's last answer, when it came (ms), and the version whose banner the user closed. */
const LatestSchema = zod.object({
  version: zod.string(),
  checkedAt: zod.number(),
  dismissed: zod.optional(zod.string()),
});

export type Latest = zod.output<typeof LatestSchema>;

/** latest.json as read: null when there is none yet, or it is not one. */
export const KeptLatestSchema = zod.nullable(LatestSchema);
