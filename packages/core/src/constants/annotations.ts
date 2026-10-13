/**
 * What a property a designer pins in a Dev Mode annotation is called in CSS (Figma's AnnotationPropertyType). A type
 * Figma adds later passes through as Figma names it.
 */
export const ANNOTATION_PINS: Readonly<Record<string, string>> = {
  width: "width",
  height: "height",
  minWidth: "min-width",
  maxWidth: "max-width",
  minHeight: "min-height",
  maxHeight: "max-height",
  fills: "background",
  strokes: "border",
  effects: "box-shadow",
  strokeWeight: "border-width",
  cornerRadius: "border-radius",
  textStyleId: "text style",
  textAlignHorizontal: "text-align",
  fontFamily: "font-family",
  fontStyle: "font-style",
  fontSize: "font-size",
  fontWeight: "font-weight",
  lineHeight: "line-height",
  letterSpacing: "letter-spacing",
  itemSpacing: "gap",
  padding: "padding",
  layoutMode: "flex-direction",
  alignItems: "align-items",
  opacity: "opacity",
  mainComponent: "component",
  gridRowGap: "row-gap",
  gridColumnGap: "column-gap",
  gridRowCount: "grid rows",
  gridColumnCount: "grid columns",
  gridRowAnchorIndex: "grid-row",
  gridRowSpan: "grid-row",
  gridColumnAnchorIndex: "grid-column",
  gridColumnSpan: "grid-column",
};

/** A text layer's fills are its text colour. */
export const TEXT_ANNOTATION_PINS: Readonly<Record<string, string>> = {
  fills: "color",
};
