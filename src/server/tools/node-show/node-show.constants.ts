/** node_show as clients list it (tools.json pins every word), 0.7.0's words. */
export const NODE_SHOW_TOOL = {
  name: "node_show",
  title: "Show layers",
  description:
    "Brings layers into view in Figma (switching to their page when needed) and selects them, so the user sees what you mean: one layer, or several on one page, fitted in view or at a zoom (1 is 100%) centred on them; select: false only moves the view. Changes only the view and the selection, never the file.",
} as const;

export const NODE_SHOW_FIELD = {
  node: "The layer's id, e.g. 54:243. Give node or nodes.",
  nodes: "Several layers on one page, fitted in view together.",
  zoom: '"fit" (default), or a zoom: 1 is 100%, 0.5 is 50%.',
  select: "Select them too (default), or only bring them into view.",
} as const;
