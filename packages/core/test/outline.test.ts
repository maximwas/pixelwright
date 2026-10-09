import { describe, expect, it } from "vitest";
import { outlineXml, tagFor } from "../src/index.ts";

describe("outline XML", () => {
  it("names tags after Figma's node types", () => {
    expect(tagFor("FRAME")).toBe("Frame");
    expect(tagFor("BOOLEAN_OPERATION")).toBe("BooleanOperation");
    expect(tagFor("COMPONENT_SET")).toBe("ComponentSet");
    expect(tagFor("SOMETHING_NEW")).toBe("SomethingNew");
  });

  it("writes the tree with boxes, escapes names, and marks cut branches with their child count", () => {
    const xml = outlineXml({
      id: "2:4868",
      name: 'Services & "more" <b>',
      type: "FRAME",
      x: 0,
      y: 1102,
      width: 1440,
      height: 1010,
      childCount: 2,
      children: [
        {
          id: "2:4869",
          name: "Cards section",
          type: "FRAME",
          x: 0,
          y: 0,
          width: 1440,
          height: 310,
          childCount: 2,
        },
        {
          id: "2:4870",
          name: "Note",
          type: "TEXT",
          x: 100,
          y: 320,
          width: 200,
          height: 20,
          childCount: 0,
        },
      ],
    });

    expect(xml).toBe(
      [
        '<Frame id="2:4868" name="Services &amp; &quot;more&quot; &lt;b&gt;" x="0" y="1102" width="1440" height="1010">',
        '  <Frame id="2:4869" name="Cards section" x="0" y="0" width="1440" height="310" $children="2"/>',
        '  <Text id="2:4870" name="Note" x="100" y="320" width="200" height="20"/>',
        "</Frame>",
      ].join("\n"),
    );
  });

  it("leaves the count out where it is unknown, as for pages not loaded yet", () => {
    expect(
      outlineXml({
        id: "0:0",
        name: "Untitled",
        type: "DOCUMENT",
        childCount: 1,
        children: [
          {
            id: "0:1",
            name: "Landing",
            type: "PAGE",
          },
        ],
      }),
    ).toBe(['<Document id="0:0" name="Untitled">', '  <Page id="0:1" name="Landing"/>', "</Document>"].join("\n"));
  });
});
