/** library_search as clients list it (tools.json pins every word): 0.7.0's words, the home named by the channel. */
export const LIBRARY_SEARCH_TOOL = {
  name: "library_search",
  title: "Search the saved component libraries",
  description:
    "Finds components in the team's libraries, which the Plugin API cannot list from another file. First, in each library file (open in Figma Desktop with the Pixelwright plugin), call save: true: its own published components (keys, variants, properties, descriptions) are saved on this computer, in the libraries folder of Pixelwright's home; save again after the library changes. Then query from any file: every word must appear in a component's name, description, page or variant values, in any order, and a typo still finds. Each result gives component (key:<key>, the component's key in its library) and properties, which in code are its props. Without query, lists the saved libraries with when each was saved. Writes nothing to Figma, so it works while Allow edits is off.",
} as const;

export const LIBRARY_SEARCH_FIELD = {
  query:
    "Words to find in the components' names, descriptions, pages and variants, in any order (button hover); a typo still finds. Left out, the saved libraries are listed.",
  save: "Save the file's own published components as a library first, replacing what was saved for it before: call it in the library file, open in Figma Desktop with the Pixelwright plugin.",
  limit: "The most components to give.",
  component: "The component's key in its library, as key:<key>.",
  components: "What the query found, best first.",
  libraries: "Every saved library.",
} as const;

/** library_search's bounds and its search (T-193), as 0.7.0 took them (m:87640ec1). */
export const LIBRARY_SEARCH = {
  /** A query: 1 to 200 characters. */
  minChars: 1,
  maxChars: 200,
  /** Twenty results by default, a hundred at most. */
  defaultLimit: 20,
  minLimit: 1,
  maxLimit: 100,
  /** How close a word must be to count as found: 0 is exact, 1 anything (Fuse's threshold); a typo still finds. */
  threshold: 0.3,
  /** A word in the name counts three times one in the description, page or variants. */
  nameWeight: 3,
  /** Figma does not publish a component whose name starts with . or _ (its hide-from-publishing rule). */
  hidden: /^[._]/,
  /** The key an instance is made from, as design_apply takes it. */
  componentKey: (key: string) => `key:${key}`,
  wordSeparator: " ",
} as const;

/** Fuse's keys: the name, and one key holding every word a component has. */
export const LIBRARY_SEARCH_KEY = { name: "name", words: "words" } as const;

/** library_search's notes and its one error, 0.7.0's words. */
export const LIBRARY_SEARCH_TEXT = {
  noLibrary:
    "No library is saved yet: open the library file in Figma Desktop with the Pixelwright plugin and call library_search {save: true} there. Its components can then be found from any file.",
  cut: (max: number, library: string) =>
    `Only the first ${max} components of ${library} are saved: the plugin lists no more.`,
  pageNotRead: (name: string, error: string) =>
    `The page ${name} could not be read (${error}): its components are not saved.`,
  unreadable: (path: string) => `${path} cannot be read, so its library is not searched.`,
  fileGone: "The plugin left the file before its library was saved: open it and save again.",
} as const;
