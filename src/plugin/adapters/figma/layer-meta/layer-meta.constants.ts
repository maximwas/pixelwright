/** The prototype action types the readers tell apart: one that goes to a layer, one that opens a URL. */
export const FIGMA_ACTION_TYPE = { node: "NODE", url: "URL" } as const;

/** The Figma values FactFieldReader reads. */
export const FACT = { none: "NONE", text: "TEXT" } as const;

/** A component property's type whose default is the set's default variant's value. */
export const COMPONENT_PROPERTY_TYPE = { variant: "VARIANT" } as const;

/** A layer inside an instance has an id like "I54:244;54:203": only such layers, and instances, carry overrides. */
export const INSTANCE_LAYER_ID = { prefix: "I" } as const;
