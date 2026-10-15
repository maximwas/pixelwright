import { CONTENT_OPERATIONS } from "./content-operations.ts";
import { NAVIGATION_OPERATIONS } from "./navigation-operations.ts";

/**
 * Every primitive the plugin runs, with what it takes and what it returns: the plugin parses the input with these and
 * the server parses the output, so both sides agree on one definition.
 */
export const OPERATION_SCHEMAS = {
  ...NAVIGATION_OPERATIONS,
  ...CONTENT_OPERATIONS,
} as const;
