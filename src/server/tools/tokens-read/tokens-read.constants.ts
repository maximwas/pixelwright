/** tokens_read as clients list it (tools.json pins every word): 0.7.0's words. */
export const TOKENS_READ_TOOL = {
  name: "tokens_read",
  title: "Read the design tokens",
  description:
    "Reads the file's design tokens: every variable collection with all its modes (light, dark…), and the paint, text and effect styles, its own and those the current page uses from a team library, named the way design_read writes them (var(--Name)). format css (default) returns ready CSS: :root holds each collection's default mode and the styles, and every mode of a collection with several is a block [data-<collection>=\"<mode>\"] (the default's too, so an element in it resets inside another mode's) to put on the element a theme applies to, the attribute design_read writes where a layer sets a mode; format json returns the same per collection and mode, with each variable's scopes (when not every field) and code syntax, which tokens_apply takes back; format dtcg returns Design Tokens Format (DTCG 2025.10) trees, one per collection mode and one of styles, to save as token files for Style Dictionary or Tokens Studio. libraries: true also lists the enabled libraries' variables by name. notes say what could not be written.",
} as const;

/** The formats tokens_read writes: css in this build; json and dtcg come with their own items. */
export const TOKEN_FORMAT = { css: "css" } as const;

/** tokens_read's bounds, as 0.7.0 took them. */
export const TOKENS_READ = {
  /** A collection's name: 1 to 200 characters; 1 to 50 names. */
  minName: 1,
  maxName: 200,
  minCollections: 1,
  maxCollections: 50,
  /** The longest output: 80 000 characters by default, the size a client reads in one go; 2 000 to 400 000. */
  minChars: 2_000,
  maxChars: 400_000,
  defaultChars: 80_000,
  /** The collections a too-long note names as parts to read one at a time. */
  partsNamed: 5,
} as const;

export const TOKENS_READ_FIELD = {
  collections: "Only these variable collections, by name (case does not matter). Default: all of them.",
  libraries:
    "Also list the enabled libraries' variables, by name and type: their values are read only once the file uses them.",
  used: "Also take the styles and variables the layers on the current page (or within) use, a team library's among them. A file that uses a library has its tokens there.",
  within: "The layer or page whose used tokens to take. Default: the current page.",
  format:
    "css: ready custom properties, a block per extra mode. json: the token model, per collection and mode. dtcg: Design Tokens Format (DTCG 2025.10) trees, one per collection mode (`<collection>.<mode>`) and one of styles, each to save as its own .json file.",
  maxChars:
    "Longest output; past it the summary comes back (with format json, also the first tokens that fit) and you read collections one at a time.",
} as const;

export const TOKENS_READ_TEXT = {
  noCollection: (missing: readonly string[], names: readonly string[]) =>
    `No collection is named ${missing.join(", ")}: the file has ${names.join(", ") || "none"}.`,
  tooLong: (
    size: number,
    maxChars: number,
    names: readonly string[],
  ) =>
    `The tokens are ${size} characters, past maxChars (${maxChars}): read them a part at a time, e.g. ${names
      .map((name) => `collections: ${JSON.stringify([name])}`)
      .join(", ")}.`,
} as const;
