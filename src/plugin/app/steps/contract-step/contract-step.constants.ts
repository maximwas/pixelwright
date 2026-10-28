export const CONTRACT_TEXT = {
  invalidInput: (
    op: string,
    problem: string,
  ) => `${op}: invalid input: ${problem}`,
} as const;
