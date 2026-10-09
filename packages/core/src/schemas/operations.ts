import * as z from "zod";

/**
 * Every primitive the plugin runs, with what it takes and what it returns: the plugin parses the input with these and
 * the server parses the output, so both sides agree on one definition. Later tasks add their operations here.
 */
export const OPERATION_SCHEMAS = {
  ping: {
    input: z.unknown(),
    output: z.object({ pong: z.literal(true) }),
  },
} as const;
