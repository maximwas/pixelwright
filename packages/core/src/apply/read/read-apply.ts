import type { XmlChild } from "../../types/xml.ts";
import { parseXml } from "../../xml/parse/parse-xml.ts";
import { xmlSyntaxError } from "../../xml/parse/xml-errors.ts";
import type { ApplyElement, ApplyError } from "../types.ts";
import { ApplyReader } from "./apply-reader.ts";

/**
 * A design_apply XML as a flat list of elements in document order, each with its parent's ref and its attributes,
 * and the errors: a parse error (nothing else then), an unknown tag (skipped, children with ids still read), an id
 * given twice or not a Figma id (skipped: a copy must not write into the original), an unknown attribute or one the
 * tag cannot take (left out, the element kept), a create its tag cannot make. `$` attributes are ignored, and a text
 * design_read shortened ($truncated) is left as it is.
 */
export function readApply(xml: string): { elements: ApplyElement[]; errors: ApplyError[] } {
  let roots: XmlChild[];

  try {
    roots = parseXml(xml);
  } catch (error) {
    const syntax = xmlSyntaxError(error);

    if (syntax === null) {
      throw error;
    }

    return {
      elements: [],
      errors: [syntax],
    };
  }

  const reader = new ApplyReader();

  reader.read(roots);

  if (reader.elements.length === 0 && reader.errors.length === 0) {
    reader.errors.push({
      line: 1,
      column: 1,
      message: "The XML holds no element: there is nothing to write.",
    });
  }

  return {
    elements: reader.elements,
    errors: reader.errors,
  };
}
