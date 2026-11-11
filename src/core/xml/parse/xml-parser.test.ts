import { describe, expect, it } from "vitest";
import { XML_NODE_KIND } from "@/core/xml/parse/parse.constants.ts";
import type { XmlNode } from "@/core/xml/parse/parse.types.ts";
import { XmlParser } from "@/core/xml/parse/xml-parser.ts";

function nodesOf(source: string): readonly XmlNode[] {
  const result = new XmlParser().parse(source);

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.nodes;
}

function failure(source: string): { line: number; column: number; message: string } {
  const result = new XmlParser().parse(source);

  if (result.ok) {
    throw new Error("parsed");
  }

  return result.error;
}

// C-001: a guess would put nodes in the wrong place, so every error names its line and column and the words are kept.
describe("XmlParser errors", () => {
  it("names the closing tag that does not match, with the line of the open tag", () => {
    expect(failure("<Frame>\n  <Text>Hi</Frame>")).toEqual({
      line: 2,
      column: 11,
      message: "Invalid XML at line 2, column 11: Expected </Text> for the tag at line 2, found </Frame>.",
    });
  });

  it("names the tag left open", () => {
    expect(failure("<Frame>\n <Text>")).toEqual({
      line: 2,
      column: 2,
      message: "Invalid XML at line 2, column 2: <Text> is not closed.",
    });
  });

  it("refuses a closing tag that closes nothing", () => {
    expect(failure("<A/>\n</B>")).toMatchObject({
      line: 2,
      column: 1,
      message: expect.stringContaining("</B> closes nothing."),
    });
  });

  it("finds the line in a long document, from the end too", () => {
    const lines = Array.from({ length: 5000 }, (_value, index) => `<Text>${index}</Text>`);

    expect(failure(`${lines.join("\n")}\n<A></B>`)).toMatchObject({ line: 5001, column: 4 });
  });

  it("names an attribute given twice at its second name", () => {
    expect(failure('<A b="1"\n   b="2"/>')).toEqual({
      line: 2,
      column: 4,
      message: "Invalid XML at line 2, column 4: Attribute b is given twice.",
    });
  });

  it("refuses a bare & and says how to write it, at the first character of the text", () => {
    expect(failure("<A>\n  a & b</A>")).toEqual({
      line: 2,
      column: 3,
      message: 'Invalid XML at line 2, column 3: "& b…" is no entity: write & as &amp;.',
    });
  });

  it("refuses an entity it does not know, in a value too", () => {
    expect(failure("<A>&bogus;</A>").message).toContain("write & as &amp;");
    expect(failure('<A b="&bogus;"/>').message).toContain("write & as &amp;");
  });

  it("refuses a < in a value, and a value without quotes", () => {
    expect(failure('<A b="x<y"/>')).toMatchObject({
      line: 1,
      column: 4,
      message: expect.stringContaining("write &lt;"),
    });
    expect(failure("<A b=c/>")).toMatchObject({
      column: 6,
      message: expect.stringContaining('The value of b needs quotes: b="…".'),
    });
    expect(failure("<A b/>").message).toContain("needs quotes");
  });

  it("refuses a value never closed and a tag never ended", () => {
    expect(failure('<A b="x').message).toContain('The value of b is not closed with "');
    expect(failure('<A b="x"').message).toContain("<A> has no closing >.");
  });

  it("refuses a < in text and a declaration", () => {
    expect(failure("<A>a < b</A>")).toMatchObject({
      column: 6,
      message: expect.stringContaining("Expected a tag name after <."),
    });
    expect(failure("<!DOCTYPE x><A/>").message).toContain("Expected a tag name after <.");
  });

  it("refuses a comment and a CDATA never closed", () => {
    expect(failure("<A><!-- x</A>")).toMatchObject({
      column: 4,
      message: expect.stringContaining("<!-- is not closed with -->."),
    });
    expect(failure("<A><![CDATA[x</A>").message).toContain("<![CDATA[ is not closed with ]]>.");
  });
});

// C-002, C-005, C-006: what is accepted.
describe("XmlParser reading", () => {
  it("accepts $, - and : in names and both quotes, and several top-level elements", () => {
    const [first, second] = nodesOf(`<Frame $css="a: b" data-theme='dark' $on-click="go"/><Text/>`);

    expect(first).toMatchObject({
      kind: XML_NODE_KIND.element,
      type: "Frame",
      props: { $css: "a: b", "data-theme": "dark", "$on-click": "go" },
      line: 1,
      column: 1,
    });
    expect(second).toMatchObject({ type: "Text", column: 54 });
  });

  it("skips comments and processing instructions and keeps CDATA verbatim as its own piece", () => {
    const [element] = nodesOf("<A><!-- c --><?pi x?>x<![CDATA[ <b> &amp; ]]>y</A>");

    expect(element).toMatchObject({
      children: [
        { kind: XML_NODE_KIND.text, value: "x" },
        { kind: XML_NODE_KIND.text, value: " <b> &amp; " },
        { kind: XML_NODE_KIND.text, value: "y" },
      ],
    });
  });

  // C-003, D-17
  it("decodes HTML named entities, numeric ones and the six XML ones", () => {
    const [element] = nodesOf('<A t="&copy;">&mdash; &#x41;&#66; &lt;&amp;&gt;&quot;&apos;&nbsp;</A>');

    expect(element).toMatchObject({ props: { t: "©" }, children: [{ value: "— AB <&>\"'\u00a0" }] });
    expect(failure("<A>&#0;</A>").message).toContain("no entity");
    expect(failure("<A>&#x110000;</A>").message).toContain("no entity");
  });

  // C-004, B-059
  it("keeps edge spaces written as references, line and paragraph separators and no-break spaces", () => {
    const [element] = nodesOf("<A>&#32;a\u2028b\u2029c\u00a0&#32;</A>");

    expect(element).toMatchObject({ children: [{ value: " a\u2028b\u2029c\u00a0 " }] });
  });

  it("drops indentation and joins lines by one space, and keeps a lone space between two spans", () => {
    expect(nodesOf("<A>\n    one\n    two\n</A>")[0]).toMatchObject({ children: [{ value: "one two" }] });
    expect(nodesOf("<A><B/> <B/></A>")[0]).toMatchObject({ children: [{}, { value: " " }, {}] });
    expect(nodesOf("<A>   </A><B>\n \n</B>")).toMatchObject([{ children: [{ value: "   " }] }, { children: [] }]);
  });

  it("refuses elements nested deeper than 256 levels at the tag that goes too deep, and never overflows the stack", () => {
    const nested = (depth: number) => `${"<A>".repeat(depth)}${"</A>".repeat(depth)}`;

    expect(nodesOf(nested(256))).toHaveLength(1);
    expect(failure(nested(257))).toEqual({
      line: 1,
      column: 769,
      message: "Invalid XML at line 1, column 769: Elements nest deeper than 256 levels.",
    });
    expect(failure(nested(100_000)).message).toContain("nest deeper than 256 levels");
  });

  it("wants a space between attributes", () => {
    expect(failure('<Frame a="x"b="y"/>')).toEqual({
      line: 1,
      column: 13,
      message: "Invalid XML at line 1, column 13: Put a space between attributes.",
    });
    expect(nodesOf('<Frame a="x"\n  b="y"/>')).toHaveLength(1);
    expect(nodesOf('<Frame a="x"\tb="y"/>')).toHaveLength(1);
    expect(nodesOf('<Frame a="x"\r\n  b="y"/>')).toHaveLength(1);
  });

  it("refuses a processing instruction that is never closed", () => {
    expect(failure("<Frame/><?pi")).toEqual({
      line: 1,
      column: 9,
      message: "Invalid XML at line 1, column 9: <? is not closed with ?>.",
    });
  });

  it("refuses a processing instruction open at the very end of the input", () => {
    expect(failure("<Frame/><?")).toEqual({
      line: 1,
      column: 9,
      message: "Invalid XML at line 1, column 9: <? is not closed with ?>.",
    });
  });

  // D-67
  it("parses 20x the lines in far less than 400x the time, so the line search is not linear", () => {
    const document = (count: number) => {
      const lines = Array.from({ length: count }, (_value, index) => `  <Text id="${index}:1">line ${index}</Text>`);

      return `<Frame>\n${lines.join("\n")}\n</Frame>`;
    };
    // The fastest of several runs is the least disturbed by a busy parallel suite.
    const fastest = (source: string) =>
      Math.min(
        ...Array.from({ length: 5 }, () => {
          const started = performance.now();

          nodesOf(source);

          return performance.now() - started;
        }),
      );

    nodesOf(document(2000)); // warm-up

    const small = fastest(document(1000));
    const large = fastest(document(20_000));

    // Linear is about 20x (measured 18x), a linear line search makes it about 400x; 100x sits between.
    expect(large / Math.max(small, 0.5)).toBeLessThan(100);
  });
});
