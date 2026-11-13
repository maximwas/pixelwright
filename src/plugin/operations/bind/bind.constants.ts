/** What the scan reads of Figma (P-164): a text's run fields, and each paint list's style field. */
export const BIND_SCAN = {
  runFills: ["fills", "fillStyleId"],
  runText: ["textStyleId", "fontName", "fontSize", "lineHeight", "letterSpacing", "textCase", "textDecoration"],
  styleField: { fills: "fillStyleId", strokes: "strokeStyleId" },
  solid: "SOLID",
  opacity: "opacity",
} as const;

export const BIND_SCAN_TEXT = {
  nothingSelected: 'Nothing is selected in Figma: select layers, or give within (a layer or page id, or "file").',
} as const;
