/**
 * Every code a failed call can start with (`CODE: message`, T-003), so the model can act on the code. One closed list;
 * on the wire the code stays a string, so a code a newer plugin sends still parses.
 */
export const ERROR_CODE = {
  pluginNotConnected: "PLUGIN_NOT_CONNECTED",
  pluginDisconnected: "PLUGIN_DISCONNECTED",
  ambiguousFile: "AMBIGUOUS_FILE",
  fileNotFound: "FILE_NOT_FOUND",
  nodeNotFound: "NODE_NOT_FOUND",
  unknownOp: "UNKNOWN_OP",
  opFailed: "OP_FAILED",
  editsDisabled: "EDITS_DISABLED",
  timeout: "TIMEOUT",
  resultTooLarge: "RESULT_TOO_LARGE",
  resultNotSerializable: "RESULT_NOT_SERIALIZABLE",
  invalidXml: "INVALID_XML",
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
