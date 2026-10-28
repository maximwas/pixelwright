/**
 * Every code a failed call can start with (`CODE: message`, T-003), so the model can act on the code. One closed list;
 * on the wire the code stays a string, so a code a newer plugin sends still parses.
 */
const ERROR_CODES = [
  "PLUGIN_NOT_CONNECTED",
  "PLUGIN_DISCONNECTED",
  "AMBIGUOUS_FILE",
  "FILE_NOT_FOUND",
  "NODE_NOT_FOUND",
  "UNKNOWN_OP",
  "OP_FAILED",
  "EDITS_DISABLED",
  "TIMEOUT",
  "RESULT_TOO_LARGE",
  "RESULT_NOT_SERIALIZABLE",
  "INVALID_XML",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
