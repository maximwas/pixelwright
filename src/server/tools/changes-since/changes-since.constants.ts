/** changes_since as clients list it (tools.json pins every word); own writes by ids since D-53 and A§15.9. */
export const CHANGES_SINCE_TOOL = {
  name: "changes_since",
  title: "What changed",
  description:
    "What changed in the file since the plugin started watching (its window opened) or since an earlier answer's cursor: each layer created, deleted or changed (with the properties), by the user, a collaborator or Pixelwright itself, on the page the user was on. Ask with no cursor once to start, then with the cursor it gives, to read again only what the designer changed. Only pages the user had open while the plugin ran are watched. Pixelwright's own are the layers its writes touched, and what execute's code changed while it ran (or within a second after); in a background tab Figma tells of changes up to a minute late, so those of execute then count as the user's, as do changes from code execute left running. What changed while the plugin was closed, and token values, baseline_diff tells against a saved baseline.",
} as const;

export const CHANGES_SINCE_FIELD = {
  cursor: "The cursor an earlier answer gave: only what changed after it. Default: all the plugin has seen.",
} as const;
