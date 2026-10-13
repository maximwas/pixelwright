import { CSS_ORDER } from "./css.ts";

/** Tags design_apply can create. */
export const CREATABLE_TAGS: ReadonlySet<string> = new Set([
  "Frame",
  "Section",
  "Text",
  "Rectangle",
  "Ellipse",
  "Line",
  "Instance",
  "Component",
  "ComponentSet",
  "Image",
  "Icon",
  "Slot",
]);

/** Tags whose layers can be changed by id but not created: vectors come as an Icon from an SVG, groups by grouping. */
export const LATER_TAGS: ReadonlySet<string> = new Set([
  "Group",
  "Vector",
  "Star",
  "Polygon",
  "BooleanOperation",
  "TextPath",
  "TransformGroup",
]);

/** Every tag design_read writes: the ones above and the rarer Figma types, changed by id. */
export const KNOWN_TAGS: ReadonlySet<string> = new Set([
  ...CREATABLE_TAGS,
  ...LATER_TAGS,
  "Span",
  "Table",
  "TableCell",
  "Media",
  "Embed",
  "LinkUnfurl",
  "Slice",
]);

/** Metadata attributes: what the layer is, not how it looks. */
export const META_ATTRIBUTES: ReadonlySet<string> = new Set([
  "id",
  "name",
  "component",
  "variant",
  "props",
  "description",
  "note",
  "href",
  "textStyle",
  "src",
  "before",
  "after",
  "copyOf",
  "prop",
  "visibleProp",
]);

/** CSS attributes the mapping table reads and writes. */
export const CSS_ATTRIBUTES: ReadonlySet<string> = new Set(CSS_ORDER);

/** What a run of text (`<Span>`) may set. */
export const SPAN_ATTRIBUTES: ReadonlySet<string> = new Set([
  "textStyle",
  "href",
  "font",
  "letter-spacing",
  "text-transform",
  "text-decoration",
  "text-underline-offset",
  "text-decoration-thickness",
  "color",
]);

/** A Figma layer id: 54:243, or an instance's layer I54:268;54:211. */
export const LAYER_ID = /^I?\d+:\d+(?:;\d+:\d+)*$/;

/** A frame's own layout, auto layout or grid (display is checked by its value). */
export const LAYOUT_ATTRIBUTES: ReadonlySet<string> = new Set([
  "flex-direction",
  "flex-wrap",
  "gap",
  "row-gap",
  "column-gap",
  "padding",
  "justify-content",
  "align-items",
  "align-content",
  "grid-template-columns",
  "grid-template-rows",
]);

/** Tags whose layers can hold a layout of their own. */
export const LAYOUT_TAGS: ReadonlySet<string> = new Set(["Frame", "Component", "ComponentSet", "Instance", "Slot"]);

/** What only a Text takes (its spans the run ones). */
export const TEXT_ATTRIBUTES: ReadonlySet<string> = new Set([
  "textStyle",
  "font",
  "letter-spacing",
  "text-transform",
  "text-decoration",
  "text-underline-offset",
  "text-decoration-thickness",
  "text-align",
  "text-wrap",
  "color",
  "text-overflow",
  "white-space",
]);

/** A box's own paint, which a Text, a Line and a Group do not have. */
export const BOX_PAINT: ReadonlySet<string> = new Set([
  "background",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "outline",
  "border-radius",
  "box-shadow",
]);

/** Shapes and assets: they clip nothing and hold no layout. */
export const SHAPE_TAGS: ReadonlySet<string> = new Set([
  "Rectangle",
  "Ellipse",
  "Line",
  "Vector",
  "Star",
  "Polygon",
  "BooleanOperation",
  "Image",
  "Icon",
  "TextPath",
]);
