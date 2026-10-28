/** The JSON Schema the SDK asks for: draft 2020-12 only (its own fallback's target), of a schema's input or output. */
export const TOOL_JSON_SCHEMA = {
  target: "draft-2020-12",
  input: "input",
  output: "output",
} as const;
