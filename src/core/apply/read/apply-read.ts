import { APPLY_TAG, TAG_BY_LOWERCASE } from "@/core/apply/apply.constants.ts";
import type { ApplyReading, ElementNode } from "@/core/apply/apply.types.ts";
import { Admission } from "@/core/apply/read/admission.ts";
import { ApplyReader } from "@/core/apply/read/apply-reader.ts";
import { AttributeRefusals } from "@/core/apply/read/attribute-refusals.ts";
import { READ_RULE, READ_TEXT } from "@/core/apply/read/read.constants.ts";
import { TextPieces } from "@/core/apply/read/text-pieces.ts";
import { Closest } from "@/core/kernel/names/closest.ts";
import { XML_NODE_KIND } from "@/core/xml/parse/parse.constants.ts";
import type { XmlNode } from "@/core/xml/parse/parse.types.ts";
import { XmlParser } from "@/core/xml/parse/xml-parser.ts";

/**
 * A design_apply XML as a flat list of elements in document order, each with its parent's ref and its attributes,
 * and the errors: a parse error (nothing else then), an unknown tag (skipped, children with ids still read), an id
 * given twice or not a Figma id (skipped: a copy must not write into the original), an unknown attribute or one the
 * tag cannot take (left out, the element kept), a create its tag cannot make. `$` attributes are ignored, and a text
 * design_read shortened ($truncated) is left as it is. The parser puts a line and column on every node, so no
 * element finds its place by searching (D-67), and the reading is one pass.
 */
export class ApplyRead {
  read(xml: string): ApplyReading {
    const parsed = new XmlParser().parse(xml);

    if (!parsed.ok) {
      return { elements: [], errors: [parsed.error], invalidXml: true };
    }

    const closest = new Closest();
    const reading = new ApplyReader({
      admission: new Admission(closest),
      refusals: new AttributeRefusals(),
      pieces: new TextPieces(),
      closest,
    }).read(this.#asWritten(parsed.nodes, true));

    if (reading.elements.length === 0 && reading.errors.length === 0) {
      reading.errors.push({ line: READ_RULE.firstLine, column: READ_RULE.firstColumn, message: READ_TEXT.noElement });
    }

    return reading;
  }

  /**
   * The XML as the agent meant it: a top-level `<Root>` without attributes (an XML document's one root) holds the top
   * level, and a tag in another case is that tag (HTML's `<span>`).
   */
  #asWritten(children: readonly XmlNode[], top: boolean): XmlNode[] {
    return children.flatMap((child): XmlNode[] => {
      if (child.kind === XML_NODE_KIND.text) {
        return [child];
      }

      if (top && child.type.toLowerCase() === APPLY_TAG.root && Object.keys(child.props).length === 0) {
        return this.#asWritten(child.children, true);
      }

      const element: ElementNode = {
        ...child,
        type: TAG_BY_LOWERCASE.get(child.type.toLowerCase()) ?? child.type,
        children: this.#asWritten(child.children, false),
      };

      return [element];
    });
  }
}
