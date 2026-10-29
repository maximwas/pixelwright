/** The prototype action types the readers tell apart: one that goes to a layer, one that opens a URL. */
export const FIGMA_ACTION_TYPE = { node: "NODE", url: "URL" } as const;

/** A layer inside an instance has an id like "I54:244;54:203": only such layers, and instances, carry overrides. */
export const INSTANCE_LAYER_ID = { prefix: "I" } as const;
