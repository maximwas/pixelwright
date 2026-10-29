import { describe, expect, it } from "vitest";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";

const writer = new XmlWriter(new XmlEscape());

/** An element with no text, and the children given. */
function element(
  id: string,
  tag: string,
  children: XmlElement[] = [],
): XmlElement {
  return { id, tag, attributes: [["id", id]], content: null, children };
}

// C-1.1: one element per line, two spaces a level; a Text keeps its Spans on its own line.
describe("XmlWriter", () => {
  it("writes an element per line, two spaces a level, and a Text with its Spans on one line", () => {
    const text: XmlElement = {
      id: "2",
      tag: "Text",
      attributes: [["id", "2"]],
      content: [
        { kind: "text", value: "Save <20%> " },
        { kind: "span", attributes: [["font-weight", "700"]], value: "now" },
        { kind: "text", value: "\nor later" },
      ],
      children: [],
    };
    const root: XmlElement = {
      ...element("1", "Frame", [text, element("3", "Rectangle")]),
      attributes: [
        ["id", "1"],
        ["name", 'Card "A"'],
      ],
    };

    expect(writer.xml(root)).toBe(
      [
        '<Frame id="1" name="Card &quot;A&quot;">',
        '  <Text id="2">Save &lt;20%&gt; <Span font-weight="700">now</Span>&#10;or later</Text>',
        '  <Rectangle id="3"/>',
        "</Frame>",
      ].join("\n"),
    );
  });

  it("keeps a text of spaces only: its spaces are written as references, so a parser does not drop them", () => {
    const blank: XmlElement = { ...element("1", "Text"), content: [{ kind: "text", value: "  " }] };

    expect(writer.xml(blank)).toBe('<Text id="1">&#32;&#32;</Text>');
  });
});
