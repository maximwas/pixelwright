/** selection_wait as clients list it (tools.json pins every word), 0.7.0's words. */
export const SELECTION_WAIT_TOOL = {
  name: "selection_wait",
  title: "Wait for a selection",
  description:
    'Waits until the user selects something in Figma, then answers with the selection, as selection_get does (changed: false when the time ran out first). Tell the user what to select before calling it: "select the card you mean in Figma".',
} as const;

export const SELECTION_WAIT_FIELD = {
  timeout: "Seconds to wait for the user to select something: 60 by default, 300 at most.",
  changed: "Whether the user selected something else before the time ran out.",
  nodes: "The selection now.",
} as const;

/** The call's timeout in seconds (T-031): a minute for the user to find the layer by default, five at most. */
export const SELECTION_WAIT_SECONDS = { perSecond: 1_000, min: 1, max: 300, default: 60 } as const;
