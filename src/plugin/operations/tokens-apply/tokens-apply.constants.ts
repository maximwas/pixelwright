/** What tokens_apply's writer says of what it could not write, or could not know (T-166, B-055). */
export const TOKENS_APPLY_TEXT = {
  planLimit: (limit: number, mode: string) =>
    `The file's Figma plan allows ${limit} mode${limit === 1 ? "" : "s"} in a collection: ${mode} is not added, and its values are left out.`,
  unknownLimit: (
    proven: number,
    collection: string,
    count: number,
    mode: string,
  ) =>
    `No collection in this file has more than ${proven} mode${proven === 1 ? "" : "s"}, so a dry run cannot tell whether its Figma plan lets ${collection} have ${count} (Starter allows 1): if not, the write refuses ${mode} and leaves its values out.`,
  gone: (name: string) => `${name} is no longer in the file: read the tokens again and send them anew.`,
  noMode: (collection: string, mode: string) => `${collection} has no mode ${mode}: list it in the collection's modes.`,
  notMade: (token: string) => `${token} names a variable this call could not make: its own error says why.`,
  hinted: (message: string, hint: string) => `${message} ${hint}`,
} as const;

/** The id a dry run gives a mode it would make: nothing is written to it. */
export const DRY_MODE = "dry";
