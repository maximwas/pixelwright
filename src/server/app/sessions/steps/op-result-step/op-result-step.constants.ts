export const OP_RESULT_TEXT = {
  badEnvelope: (op: string) =>
    `${op}: the plugin's answer is not an op result; update the plugin and the server together`,
  badOutput: (
    op: string,
    problem: string,
  ) => `${op}: the plugin's answer does not match the op's output: ${problem}`,
} as const;
