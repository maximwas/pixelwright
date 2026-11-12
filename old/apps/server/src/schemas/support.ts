import * as z from "zod";

/** support.json: when the support note was last given. */
export const SupportStateSchema = z.object({ lastShownAt: z.string() });
