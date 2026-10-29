/** viewport_get as clients list it (tools.json pins every word), 0.7.0's words. */
export const VIEWPORT_GET_TOOL = {
  name: "viewport_get",
  title: "What the user sees",
  description:
    'What the user is looking at in Figma now: the page, the zoom, the part of the page in view (page px), and the page\'s layers and their children that meet it, outermost first. Use it when the user says "this" or "here" without selecting anything; selection_get gives what is selected.',
} as const;
