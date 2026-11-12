import { describe, expect, it } from "vitest";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { OutlineXml } from "@/core/xml/outline/outline-xml.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import type { OutlineNode } from "@/shared/ops/outline/outline.schema.ts";

const outline = new OutlineXml(new NumberFormat(), new NodeTag(), new XmlWriter(new XmlEscape()));

/** A section with an instance whose children are past the depth, and a hidden text: boxes as the plugin reads them. */
const SECTION: OutlineNode = {
  id: "81:1541",
  name: "Start here",
  type: "SECTION",
  x: 0,
  y: 0,
  width: 1440.4,
  height: 900,
  childCount: 2,
  children: [
    {
      id: "81:1627",
      name: 'Install <card> & "more"',
      type: "INSTANCE",
      component: "Card",
      variant: "Size=Large",
      x: 10.4,
      y: -0.3,
      width: 320,
      height: 200.5,
      dev: "ready",
      childCount: 3,
    },
    { id: "81:1700", name: "Note", type: "TEXT", x: 40, y: 260, width: 100, height: 20, hidden: true, childCount: 0 },
  ],
};

describe("OutlineXml", () => {
  // C-009: attributes in order id, name, component, variant, box, hidden, dev; `$children` only where some are not listed.
  it("writes one tag per line, boxes in whole px (D-15), names escaped, $children on unlisted children", () => {
    expect(outline.xml(SECTION)).toBe(
      [
        '<Section id="81:1541" name="Start here" x="0" y="0" width="1440" height="900">',
        '  <Instance id="81:1627" name="Install &lt;card&gt; &amp; &quot;more&quot;" component="Card" variant="Size=Large" x="10" y="0" width="320" height="201" dev="ready" $children="3"/>',
        '  <Text id="81:1700" name="Note" x="40" y="260" width="100" height="20" hidden="true"/>',
        "</Section>",
      ].join("\n"),
    );
    expect(outline.count(SECTION)).toBe(3);
  });

  it("tags a type the vocabulary lacks by 0.7.0's rule, the type in PascalCase", () => {
    expect(outline.xml({ id: "1:2", name: "New", type: "MAGIC_WAND_TOOL" })).toBe(
      '<MagicWandTool id="1:2" name="New"/>',
    );
  });
});
