import { CSS_ORDER } from "./css.ts";

/** Tags design_apply can create now. */
export const CREATABLE_TAGS: ReadonlySet<string> = new Set([
  "Frame",
  "Section",
  "Text",
  "Rectangle",
  "Ellipse",
  "Line",
]);

/** Tags whose layers can be changed by id now and created only in stage 4b (components, images, vectors). */
export const LATER_TAGS: ReadonlySet<string> = new Set([
  "Group",
  "Component",
  "ComponentSet",
  "Instance",
  "Image",
  "Icon",
  "Slot",
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
