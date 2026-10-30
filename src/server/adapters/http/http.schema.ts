import * as zod from "zod/mini";

/** npm's answer for one dist-tag, as far as the update banner reads it. */
export const NpmLatestSchema = zod.object({ version: zod.string() });
