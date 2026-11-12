import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";

export const LOOKUP_TEXT = {
  notFound: NODE_TEXT.notFound,
  document: (id: string) => `${id} is the document: give its pages or layers.`,
  noLayers: (id: string) => `${id} has no layers inside to search.`,
} as const;

/** A page's screens (P-121): frames, components and instances, at its top or in its sections. */
export const SCREEN = { section: "SECTION", types: ["FRAME", "COMPONENT", "INSTANCE"] } as const;

/** How often a walk reads the clock (P-075): every 500 layers is cheap beside the walk and soon after the deadline. */
export const WALK = { checkEvery: 500 } as const;
