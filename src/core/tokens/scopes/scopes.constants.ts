import { VARIABLE_TYPE, VARIABLE_VALUE } from "@/core/tokens/model/model.constants.ts";

/** Figma's variable scopes, in the order Figma keeps them: the fields whose pickers offer a variable. */
export const VARIABLE_SCOPES = [
  "ALL_SCOPES",
  "TEXT_CONTENT",
  "CORNER_RADIUS",
  "WIDTH_HEIGHT",
  "GAP",
  "ALL_FILLS",
  "FRAME_FILL",
  "SHAPE_FILL",
  "TEXT_FILL",
  "STROKE_COLOR",
  "STROKE_FLOAT",
  "EFFECT_FLOAT",
  "EFFECT_COLOR",
  "OPACITY",
  "COLOR_OPACITY",
  "FONT_FAMILY",
  "FONT_STYLE",
  "FONT_WEIGHT",
  "FONT_SIZE",
  "LINE_HEIGHT",
  "LETTER_SPACING",
  "PARAGRAPH_SPACING",
  "PARAGRAPH_INDENT",
] as const;

/** The scopes Figma lets each type take (m:b0144d23, live 2026-10-17: any other throws "Invalid scope for this variable type"). */
export const TYPE_SCOPES: Readonly<Record<string, readonly string[]>> = {
  [VARIABLE_TYPE.color]: [
    VARIABLE_VALUE.allScopes,
    "ALL_FILLS",
    "FRAME_FILL",
    "SHAPE_FILL",
    "TEXT_FILL",
    "STROKE_COLOR",
    "EFFECT_COLOR",
  ],
  [VARIABLE_TYPE.float]: [
    VARIABLE_VALUE.allScopes,
    "TEXT_CONTENT",
    "CORNER_RADIUS",
    "WIDTH_HEIGHT",
    "GAP",
    "STROKE_FLOAT",
    "EFFECT_FLOAT",
    "OPACITY",
    "COLOR_OPACITY",
    "FONT_WEIGHT",
    "FONT_SIZE",
    "LINE_HEIGHT",
    "LETTER_SPACING",
    "PARAGRAPH_SPACING",
    "PARAGRAPH_INDENT",
  ],
  [VARIABLE_TYPE.string]: [VARIABLE_VALUE.allScopes, "TEXT_CONTENT", "FONT_FAMILY", "FONT_STYLE"],
  [VARIABLE_TYPE.boolean]: [VARIABLE_VALUE.allScopes],
};

/** ALL_FILLS, and the fills it covers: Figma refuses it beside any of them. */
export const ALL_FILLS = "ALL_FILLS";

export const FILL_SCOPES: readonly string[] = ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"];

/** Why Figma would refuse a variable's scopes (FX-050). */
export const SCOPES_TEXT = {
  refused: (
    type: string,
    refused: readonly string[],
    allowed: readonly string[],
  ) =>
    `A ${type} variable cannot take ${refused.join(", ")}: its scopes are ${allowed.join(", ")}.`,
  alone: "ALL_SCOPES stands alone: it already offers the variable for every field.",
  fills: "ALL_FILLS already covers FRAME_FILL, SHAPE_FILL and TEXT_FILL: give it or them.",
  boolean: "A BOOLEAN variable is offered for every field: its scopes can only be ALL_SCOPES.",
} as const;
