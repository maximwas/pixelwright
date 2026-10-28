/** console.dir's output as one line of stderr. */
export const STDOUT_GUARD = {
  line: (text: string) => `${text}\n`,
} as const;
