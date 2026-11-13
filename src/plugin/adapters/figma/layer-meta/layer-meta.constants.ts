/** The prototype action types the readers tell apart: one that goes to a layer, one that opens a URL. */
export const FIGMA_ACTION_TYPE = { node: "NODE", url: "URL" } as const;

/** The Figma values FactFieldReader reads. */
export const FACT = { none: "NONE", text: "TEXT" } as const;

/** Component property types: a variant's default is the set's default variant's value; a swap's value a component id. */
export const COMPONENT_PROPERTY_TYPE = {
  variant: "VARIANT",
  boolean: "BOOLEAN",
  instanceSwap: "INSTANCE_SWAP",
} as const;

/** A layer inside an instance has an id like "I54:244;54:203": only such layers, and instances, carry overrides. */
export const INSTANCE_LAYER_ID = { prefix: "I" } as const;
