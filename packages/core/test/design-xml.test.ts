import { describe, expect, it } from "vitest";
import { designXml, type SnapshotNode } from "../src/index.ts";
import { fixture } from "./helpers/fixtures.ts";

const row = fixture("positivus-services-row");

const FIRST_CARD = `<Frame id="2:4869" name="Cards section" display="flex" width="1440px" height="310px" padding="0 100px" gap="40px">
  <Frame id="2:4870" name="Card" display="flex" width="600px" padding="50px" justify-content="space-between" align-items="center" overflow="hidden" border-radius="45px" border="1px solid var(--Dark)" background="var(--Grey)" box-shadow="0 5px 0 0 #191A23">
    <Frame id="2:4871" name="Heading and link" display="flex" flex-direction="column" justify-content="center" gap="93px">
      <Instance id="2:4872" name="Heading" component="Heading" variant="Property 1=Green" display="flex" flex-direction="column">
        <Frame id="I2:4872;330:291" name="Label" display="flex" flex-direction="column" padding="0 7px" border-radius="7px" background="var(--Green)">
          <Text id="I2:4872;330:292" name="Label" textStyle="h3" color="#000">Search engine</Text>
        </Frame>
        <Frame id="I2:4872;334:1522" name="Label" display="flex" flex-direction="column" padding="0 7px" border-radius="7px" background="var(--Green)">
          <Text id="I2:4872;334:1523" name="Label" textStyle="h3" color="#000">optimization</Text>
        </Frame>
      </Instance>
      <Instance id="2:4873" name="Link" component="Link" variant="Property 1=Black" display="flex" align-items="center" gap="15px">
        <Icon id="I2:4873;334:1478" name="Icon" src="assets/icon.svg" width="41px" height="41px"/>
        <Text id="I2:4873;334:1481" name="Label" font="400 20px/28px 'Space Grotesk'" color="var(--Black)">Learn more</Text>
      </Instance>
    </Frame>
    <Frame id="2:4874" name="Illustration" width="210px" height="170px">
      <Image id="2:4875" name="tokyo-magnifier-web-search-with-elements 2" src="assets/tokyo-magnifier-web-search-with-elements-2.png" position="absolute" left="0" top="2px" width="210px" height="166px"/>
    </Frame>
  </Frame>`;

describe("design XML of the Positivus Services row", () => {
  it("matches the approved example, with the rules decided since", () => {
    expect(designXml(row).xml.startsWith(FIRST_CARD)).toBe(true);
  });

  it("lists the tokens, text styles and fonts the XML refers to", () => {
    const read = designXml(row);

    expect(read.tokens).toEqual({
      "--Black": "#000",
      "--Dark": "#191A23",
      "--Green": "#B9FF66",
      "--Grey": "#F3F3F3",
    });
    expect(read.textStyles).toEqual({ h3: "500 30px/normal 'Space Grotesk'" });
    expect(read.fonts).toEqual({ "Space Grotesk": ["400", "500"] });
  });

  it("plans one asset per icon and image, names slugged from the layers, a clash suffixed", () => {
    expect(designXml(row).assets).toEqual([
      {
        node: "I2:4873;334:1478",
        kind: "icon",
        format: "SVG",
        src: "assets/icon.svg",
      },
      {
        node: "2:4875",
        kind: "image",
        format: "PNG",
        src: "assets/tokyo-magnifier-web-search-with-elements-2.png",
      },
      {
        node: "I2:4879;334:1478",
        kind: "icon",
        format: "SVG",
        src: "assets/icon-2.svg",
      },
      {
        node: "2:4881",
        kind: "image",
        format: "PNG",
        src: "assets/tokyo-selecting-a-value-in-the-browser-window-1.png",
      },
    ]);
  });
});

describe("design XML rules", () => {
  const base = {
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    childCount: 0,
  };
  const read = (root: SnapshotNode) =>
    designXml({
      root,
      styles: {},
      variables: {},
    });

  it("writes mixed runs of a text as spans holding what differs, and escapes the text", () => {
    const segment = {
      fontName: {
        family: "Inter",
        style: "Regular",
      },
      fontSize: 16,
      fontWeight: 400,
      textDecoration: "NONE",
      textCase: "ORIGINAL",
      lineHeight: { unit: "AUTO" },
      letterSpacing: {
        unit: "PIXELS",
        value: 0,
      },
      fills: [],
      fillStyleId: "",
      textStyleId: "",
    };
    const { xml } = read({
      ...base,
      id: "1:1",
      name: "Copy",
      type: "TEXT",
      layoutSizingHorizontal: "HUG",
      layoutSizingVertical: "HUG",
      text: {
        characters: "Fast & <free>",
        textAutoResize: "WIDTH_AND_HEIGHT",
        textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP",
        segments: [
          {
            ...segment,
            characters: "Fast & ",
            start: 0,
            end: 7,
          },
          {
            ...segment,
            characters: "<free>",
            start: 7,
            end: 13,
            fontWeight: 700,
            fontName: {
              family: "Inter",
              style: "Bold",
            },
          },
        ],
      },
    });

    expect(xml).toBe(
      `<Text id="1:1" name="Copy" width="100px" height="100px" font="400 16px/normal 'Inter'">Fast &amp; <Span font="700 16px/normal 'Inter'">&lt;free&gt;</Span></Text>`,
    );
  });

  it("leaves hidden layers out, names a text only when the name is not its content", () => {
    const { xml } = read({
      ...base,
      id: "1:1",
      name: "Box",
      type: "FRAME",
      layoutMode: "VERTICAL",
      childCount: 2,
      children: [
        {
          ...base,
          id: "1:2",
          name: "Hello",
          type: "TEXT",
          layoutSizingHorizontal: "HUG",
          layoutSizingVertical: "HUG",
          text: {
            characters: "Hello",
            textAutoResize: "WIDTH_AND_HEIGHT",
            textAlignHorizontal: "LEFT",
            textAlignVertical: "TOP",
            segments: [],
          },
        },
        {
          ...base,
          id: "1:3",
          name: "Draft",
          type: "FRAME",
          visible: false,
        },
      ],
    });

    expect(xml).toBe(
      [
        '<Frame id="1:1" name="Box" display="flex" flex-direction="column" width="100px" height="100px">',
        '  <Text id="1:2">Hello</Text>',
        "</Frame>",
      ].join("\n"),
    );
  });

  it("takes a layer the designer marked for export as an asset in its format, and a masked group as one image", () => {
    const { xml, assets } = read({
      ...base,
      id: "1:1",
      name: "Row",
      type: "FRAME",
      childCount: 2,
      children: [
        {
          ...base,
          id: "1:2",
          name: "Logo",
          type: "FRAME",
          exportSettings: [{ format: "SVG" }],
          childCount: 1,
          children: [
            {
              ...base,
              id: "1:3",
              name: "Mark",
              type: "RECTANGLE",
            },
          ],
        },
        {
          ...base,
          id: "1:4",
          name: "Avatar",
          type: "GROUP",
          childCount: 2,
          children: [
            {
              ...base,
              id: "1:5",
              name: "Mask",
              type: "ELLIPSE",
              isMask: true,
            },
            {
              ...base,
              id: "1:6",
              name: "Photo",
              type: "RECTANGLE",
            },
          ],
        },
      ],
    });

    expect(xml).toContain('<Icon id="1:2" name="Logo" src="assets/logo.svg"');
    expect(xml).toContain('<Image id="1:4" name="Avatar" src="assets/avatar.png"');
    expect(assets.map((asset) => [asset.node, asset.kind, asset.format])).toEqual([
      ["1:2", "icon", "SVG"],
      ["1:4", "image", "PNG"],
    ]);
  });

  it("draws a component instance made only of vectors (a logo) as one icon, named by its variant", () => {
    const hero = fixture("positivus-hero");
    const { xml, assets } = designXml(hero);

    expect(xml).toContain(
      '<Icon id="2:4862" name="Company logo" component="Company logo" variant="Company=Amazon" src="assets/company-logo-amazon.svg" width="124px" height="48px" $css="mix-blend-mode: luminosity"/>',
    );
    expect(xml).toContain(
      '<Icon id="2:4788" name="Logo" component="Logo" variant="Property 1=Default" src="assets/logo-default.svg"',
    );
    expect(assets.filter((asset) => asset.kind === "icon")).toHaveLength(8);
  });
});
