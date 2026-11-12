import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** The props each write step takes, in the order it sets them. */
export const STEP_KEYS = {
  name: ["name"],
  layout: [
    "layoutMode",
    "layoutWrap",
    "itemSpacing",
    "counterAxisSpacing",
    "padding",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "counterAxisAlignContent",
  ],
  size: ["width", "height"],
  opacity: ["opacity"],
  clip: ["clipsContent"],
  fills: ["fills"],
} as const satisfies Record<string, readonly (keyof FigmaProps)[]>;

/** Figma's paint type of a colour. */
export const FIGMA_PAINT = { solid: "SOLID" } as const;

/** Hiding runs last, outside the steps (P-149). */
export const HIDDEN_KEY = "visible" satisfies keyof FigmaProps;

export const WRITERS_TEXT = {
  token: (token: string) => `The token ${token} is not bound to Figma in this release: write its value.`,
  paint: (kind: string) => `A ${kind} background is not written to Figma in this release: write a colour.`,
  colourSpace: "A display-p3 colour is not written to Figma in this release: write it in sRGB.",
} as const;
