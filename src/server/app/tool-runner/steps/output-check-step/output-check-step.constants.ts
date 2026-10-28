/** Why an answer is refused before it leaves: the zod issues, pretty-printed. */
export const OUTPUT_CHECK = {
  mismatch: (issues: string) => `the answer does not match its outputSchema: ${issues}`,
} as const;
