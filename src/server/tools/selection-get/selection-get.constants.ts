/** selection_get as clients list it (tools.json pins every word), 0.7.0's words. */
export const SELECTION_GET_TOOL = {
  name: "selection_get",
  title: "Read the selection",
  description:
    'Lists the layers the user selected in Figma (id, name, type, box in page coordinates). Call it when the user says "this", "the selected one" or "what I picked", then read those ids with design_read or outline.',
} as const;
