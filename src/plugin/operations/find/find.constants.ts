/** The run fields a mixed text's font sizes are read from. */
export const FIND_RUN = { fontSize: ["fontSize"] } as const;

/** textRegex matches in any case, as text does. */
export const FIND_REGEX = { flags: "i" } as const;

export const FIND_TEXT = {
  regex: (message: string) => `textRegex is not a valid regular expression: ${message}`,
  variant: 'variant is a list of Name=Value, separated by commas: "State=Hover, Size=L".',
} as const;
