export const LOOKUP_TEXT = {
  notFound: (id: string) => `No node ${id} in this file: find ids with nodes_find, outline or selection_get.`,
  document: (id: string) => `${id} is the document: give its pages or layers.`,
  noLayers: (id: string) => `${id} has no layers inside to search.`,
} as const;

/** The node types a lookup tells apart: the document, and the page every layer sits on. */
export const LOOKUP_NODE_TYPE = { document: "DOCUMENT", page: "PAGE" } as const;

/** How often a walk reads the clock (P-075): every 500 layers is cheap beside the walk and soon after the deadline. */
export const WALK = { checkEvery: 500 } as const;
