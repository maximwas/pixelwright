import { describe, expect, it } from "vitest";
import { designXml, type SnapshotNode } from "../src/index.ts";
import { fixture } from "./helpers/fixtures.ts";

const row = fixture("orbit-plans");
const customers = fixture("orbit-customers");

const FIRST_CARD = `<Frame id="54:243" name="Plans" display="flex" width="1200px" height="394px" gap="var(--space-24)">
  <Instance id="54:244" name="Plan – Starter" component="Plan Card" props="Price=$0, Popular=false, Description=For side projects and trying things out., Name=Starter" display="flex" flex-direction="column" flex="1" padding="var(--space-32)" gap="var(--space-24)" border-radius="var(--radius-lg)" border="1px solid var(--color-line)" background="var(--color-surface)" box-shadow="var(--Shadow-Card)">
    <Frame id="I54:244;54:203" name="Header" display="flex" align-self="stretch" justify-content="space-between" align-items="center" overflow="hidden">
      <Text id="I54:244;54:204" name="Name" textStyle="Heading/H3" color="var(--color-ink)">Starter</Text>
    </Frame>
    <Text id="I54:244;54:207" name="Description" textStyle="Body Small" align-self="stretch" color="var(--color-ink-muted)">For side projects and trying things out.</Text>
    <Frame id="I54:244;54:208" name="Price" display="flex" align-items="baseline" gap="var(--space-4)" overflow="hidden">
      <Text id="I54:244;54:209" name="Amount" textStyle="Price" color="var(--color-ink)">$0</Text>
      <Text id="I54:244;54:210" name="Period" textStyle="Body" color="var(--color-ink-muted)">/ month</Text>
    </Frame>
    <Instance id="I54:244;54:211" name="Button" component="Button" variant="Variant=Primary, State=Default" props="Label=Start free" display="flex" align-self="stretch" padding="var(--space-12) var(--space-24)" justify-content="center" align-items="center" border-radius="var(--radius-md)" background="var(--color-brand)">
      <Text id="I54:244;54:211;54:190" name="Label" textStyle="Button" color="var(--color-on-brand)">Start free</Text>
    </Instance>
    <Frame id="I54:244;54:213" name="Features" display="flex" flex-direction="column" align-self="stretch" gap="var(--space-12)" overflow="hidden">
      <Frame id="I54:244;54:214" name="Feature" display="flex" align-items="center" gap="var(--space-8)" overflow="hidden">
        <Icon id="I54:244;54:215" name="Icon/Check" component="Icon/Check" src="assets/icon-check.svg" width="20px" height="20px"/>
        <Text id="I54:244;54:217" name="Text" textStyle="Body Small" color="var(--color-ink)">Unlimited projects</Text>
      </Frame>
      <Frame id="I54:244;54:218" name="Feature" display="flex" align-items="center" gap="var(--space-8)" overflow="hidden">
        <Icon id="I54:244;54:219" name="Icon/Check" component="Icon/Check" src="assets/icon-check-2.svg" width="20px" height="20px"/>
        <Text id="I54:244;54:221" name="Text" textStyle="Body Small" color="var(--color-ink)">Version history for 30 days</Text>
      </Frame>
      <Frame id="I54:244;54:222" name="Feature" display="flex" align-items="center" gap="var(--space-8)" overflow="hidden">
        <Icon id="I54:244;54:223" name="Icon/Check" component="Icon/Check" src="assets/icon-check-3.svg" width="20px" height="20px"/>
        <Text id="I54:244;54:225" name="Text" textStyle="Body Small" color="var(--color-ink)">Email support</Text>
      </Frame>
    </Frame>
  </Instance>`;

describe("design XML of the Orbit Plans row", () => {
  it("matches the approved example, with the rules decided since", () => {
    expect(designXml(row).xml.startsWith(FIRST_CARD)).toBe(true);
  });

  it("writes an instance a Code Connect template renders as $code, without its children, and the rest as before", () => {
    const plain = designXml(row);
    const read = designXml(row, { connected: new Map([["I54:244;54:211", "Button"]]) });
    const button = FIRST_CARD.slice(
      FIRST_CARD.indexOf('    <Instance id="I54:244;54:211"'),
      FIRST_CARD.indexOf('    <Frame id="I54:244;54:213"'),
    );

    expect(read.xml).toBe(
      plain.xml.replace(
        button,
        '    <Instance id="I54:244;54:211" name="Button" component="Button" variant="Variant=Primary, State=Default" props="Label=Start free" display="flex" align-self="stretch" padding="var(--space-12) var(--space-24)" justify-content="center" align-items="center" border-radius="var(--radius-md)" background="var(--color-brand)" $code="Button"/>\n',
      ),
    );
    expect(read.truncated).toEqual(plain.truncated);
  });

  it("lists the tokens, text styles and fonts the XML refers to", () => {
    const read = designXml(row);

    expect(read.tokens).toEqual({
      "--color-accent": "#FF6B3D",
      "--color-brand": "#3B2FD9",
      "--color-ink": "#14161F",
      "--color-ink-muted": "#4A4F5E",
      "--color-line": "#E1E5EE",
      "--color-on-brand": "#FFF",
      "--color-surface": "#FFF",
      "--radius-lg": "24px",
      "--radius-md": "12px",
      "--radius-pill": "999px",
      "--Shadow-Card": "0 12px 32px -8px rgba(20, 22, 31, 0.12)",
      "--space-12": "12px",
      "--space-24": "24px",
      "--space-32": "32px",
      "--space-4": "4px",
      "--space-8": "8px",
    });
    expect(read.textStyles).toEqual({
      Body: "400 16px/24px 'Inter'",
      "Body Small": "400 14px/20px 'Inter'",
      Button: "600 15px/20px 'Inter'",
      "Heading/H3": "500 24px/30px 'Space Grotesk'; letter-spacing: -0.01em",
      Label: "600 12px/16px 'Inter'; letter-spacing: 0.06em; text-transform: uppercase",
      Price: "700 48px/52px 'Space Grotesk'; letter-spacing: -0.02em",
    });
    expect(read.fonts).toEqual({
      "Space Grotesk": ["500", "700"],
      Inter: ["400", "600"],
    });
  });
});

describe("design XML of the Orbit Customers frame", () => {
  it("plans one asset per icon and image, names slugged from the layers and variants, a clash suffixed", () => {
    expect(designXml(customers).assets).toEqual([
      {
        node: "54:437",
        kind: "icon",
        format: "SVG",
        src: "assets/logo-nova.svg",
      },
      {
        node: "54:441",
        kind: "icon",
        format: "SVG",
        src: "assets/logo-lumen.svg",
      },
      {
        node: "54:445",
        kind: "icon",
        format: "SVG",
        src: "assets/logo-nova-2.svg",
      },
      {
        node: "54:452",
        kind: "icon",
        format: "SVG",
        src: "assets/arrow.svg",
      },
      {
        node: "54:454",
        kind: "image",
        format: "PNG",
        src: "assets/product-shot.png",
        scale: 2,
      },
      {
        node: "54:456",
        kind: "image",
        format: "PNG",
        src: "assets/avatar.png",
      },
    ]);
  });

  it("draws a component instance made only of vectors (a logo) as one icon named by its variant, and a masked group and a layer marked for export as images", () => {
    const { xml } = designXml(customers);

    expect(xml).toContain(
      '<Icon id="54:437" name="Logo" component="Logo" variant="Brand=Nova" src="assets/logo-nova.svg" position="absolute" left="40px" top="124px" width="120px" height="32px"/>',
    );
    expect(xml).toContain('<Image id="54:456" name="Avatar" src="assets/avatar.png"');
    expect(xml).toContain('<Image id="54:454" name="Product shot" src="assets/product-shot.png"');
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
});
