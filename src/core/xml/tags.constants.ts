/**
 * The tag of each Figma node type (§1.2), as 0.7.0 wrote them: the type in PascalCase, FRAME is Frame and
 * BOOLEAN_OPERATION is BooleanOperation. A type Figma adds later gets its tag by the same rule (TAG_RULE).
 */
export const TAG = {
  DOCUMENT: "Document",
  PAGE: "Page",
  SECTION: "Section",
  FRAME: "Frame",
  GROUP: "Group",
  TRANSFORM_GROUP: "TransformGroup",
  COMPONENT_SET: "ComponentSet",
  COMPONENT: "Component",
  INSTANCE: "Instance",
  SLOT: "Slot",
  BOOLEAN_OPERATION: "BooleanOperation",
  VECTOR: "Vector",
  STAR: "Star",
  LINE: "Line",
  ELLIPSE: "Ellipse",
  POLYGON: "Polygon",
  RECTANGLE: "Rectangle",
  TEXT: "Text",
  TEXT_PATH: "TextPath",
  SLICE: "Slice",
  STICKY: "Sticky",
  CONNECTOR: "Connector",
  SHAPE_WITH_TEXT: "ShapeWithText",
  CODE_BLOCK: "CodeBlock",
  STAMP: "Stamp",
  WIDGET: "Widget",
  EMBED: "Embed",
  LINK_UNFURL: "LinkUnfurl",
  MEDIA: "Media",
  HIGHLIGHT: "Highlight",
  WASHI_TAPE: "WashiTape",
  TABLE: "Table",
  TABLE_CELL: "TableCell",
  SLIDE: "Slide",
  SLIDE_ROW: "SlideRow",
  SLIDE_GRID: "SlideGrid",
  INTERACTIVE_SLIDE_ELEMENT: "InteractiveSlideElement",
} as const;

/** How a type the table lacks becomes a tag: its words, split at `_`, each capitalised and joined. */
export const TAG_RULE = { wordSeparator: "_" } as const;
