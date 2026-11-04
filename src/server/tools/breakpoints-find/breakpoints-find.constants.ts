/** breakpoints_find as clients list it (tools.json pins every word): 0.7.0's words. */
export const BREAKPOINTS_FIND_TOOL = {
  name: "breakpoints_find",
  title: "Find a screen's other widths",
  description:
    "Finds the screen a layer is on at the page's other widths (Desktop, Tablet, Mobile): the page's frames, and those in its sections, whose names match once size words are left out (Desktop, Mobile, 1440, 375px) and whose children share names with it, narrowest first, each with a score. Compare them with nodes_diff to write the media queries.",
} as const;

export const BREAKPOINTS_FIND_FIELD = { node: "A screen's id, or a layer's on it." } as const;
