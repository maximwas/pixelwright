/** flow_read as clients list it (tools.json pins every word): 0.7.0's words. */
export const FLOW_READ_TOOL = {
  name: "flow_read",
  title: "Map the prototype",
  description:
    "A page's prototype as a map, for an app's routes: where its flows start, its screens (the page's frames, and those in its sections) with their sizes, and every interaction that leaves its layer: from which screen and layer, on what trigger, to which screen (or back, close, a URL), and how it moves (\"navigate to Detail; smart animate 300ms ease-out\"). A variant switch stays inside its component and is read by design_read as $on-*.",
} as const;

export const FLOW_READ_FIELD = { page: "The page's id. Default: the current page." } as const;

/** Figma's words a link is told by: a NODE action's default navigation, a variant switch, a reaction with no trigger. */
export const FLOW_READ = { navigate: "NAVIGATE", changeTo: "CHANGE_TO", noTrigger: "NONE" } as const;
