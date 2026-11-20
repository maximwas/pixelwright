/** What the scan reads of Figma (P-164): a text's run fields, and each paint list's style field. */
export const BIND_SCAN = {
  runFills: ["fills", "fillStyleId"],
  runText: ["textStyleId", "fontName", "fontSize", "lineHeight", "letterSpacing", "textCase", "textDecoration"],
  styleField: { fills: "fillStyleId", strokes: "strokeStyleId" },
  solid: "SOLID",
  opacity: "opacity",
} as const;

/** What the writer sets in Figma (P-164): a style field's setter, and the bound fields it rebinds through their lists. */
export const BIND_WRITE = {
  styleSetters: {
    fillStyleId: "setFillStyleIdAsync",
    strokeStyleId: "setStrokeStyleIdAsync",
    effectStyleId: "setEffectStyleIdAsync",
    textStyleId: "setTextStyleIdAsync",
  },
  /** Bound fields that hold paints, effects, a text's runs or properties: rebound through those, never as a field. */
  listFields: ["fills", "strokes", "effects", "textRangeFills", "componentProperties"],
  runStyles: ["fillStyleId", "textStyleId"],
  runVariables: ["fills", "boundVariables"],
  textStyle: "TEXT",
  text: "text",
  keyJoint: "\u0000",
  /** Failures listed: as many as core lists errors, so one reason on every layer (a library off) stays short. */
  maxFailed: 100,
} as const;

export const BIND_WRITE_TEXT = {
  variable: (token: string) => `Figma cannot reach the variable ${token} now: enable its library.`,
  style: (token: string) => `Figma cannot reach the style ${token} now: enable its library.`,
  noLayer: (id: string) => `${id} is no layer to bind.`,
  noField: (field: string) => `This layer has no ${field} to bind.`,
} as const;

export const BIND_SCAN_TEXT = {
  nothingSelected: 'Nothing is selected in Figma: select layers, or give within (a layer or page id, or "file").',
} as const;
