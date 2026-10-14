import { type FakeNode, type FakeOptions, installFigma, tree } from "./fake-figma.ts";

/** A text as a snapshot reads it: one run in one font, black, left and top aligned, sizing itself. */
export function textNode(id: string, characters: string, family = "Inter", style = "Regular") {
  return {
    id,
    type: "TEXT",
    name: characters,
    characters,
    textAutoResize: "WIDTH_AND_HEIGHT",
    fontName: {
      family,
      style,
    },
    fontSize: 16,
    fontWeight: style === "Regular" ? 400 : 500,
    fillStyleId: "",
    textStyleId: "",
    hyperlink: null,
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    textDecoration: "NONE",
    textCase: "ORIGINAL",
    lineHeight: { unit: "AUTO" },
    letterSpacing: {
      unit: "PIXELS",
      value: 0,
    },
    fills: [
      {
        type: "SOLID",
        visible: true,
        opacity: 1,
        blendMode: "NORMAL",
        color: {
          r: 0,
          g: 0,
          b: 0,
        },
      },
    ],
  };
}

/** A team library's Heading set: each variant holds a label box with a text. */
export function headingSet(): FakeNode {
  const variant = (id: string, value: string, box: string, label: string) => ({
    id,
    name: `Property 1=${value}`,
    type: "COMPONENT",
    layoutMode: "VERTICAL",
    children: [
      {
        id: box,
        name: "Label box",
        layoutMode: "HORIZONTAL",
        children: [textNode(label, "Title")],
      },
    ],
  });
  const set = tree({
    id: "7:1",
    name: "Heading",
    type: "COMPONENT_SET",
    componentPropertyDefinitions: {
      "Property 1": {
        type: "VARIANT",
        defaultValue: "Default",
        variantOptions: ["Default", "Green"],
      },
    },
    children: [variant("7:2", "Default", "3:4", "3:5"), variant("7:3", "Green", "3:6", "3:7")],
  });

  set.defaultVariant = set.children?.[0];

  return set;
}

/** The page a design_apply runs on, each of its layer kinds once or twice. */
function page(main: FakeNode): FakeNode {
  return tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        layoutMode: "VERTICAL",
        children: [
          {
            id: "1:5",
            name: "Heading and link",
            layoutMode: "VERTICAL",
            children: [textNode("1:2", "Hello"), textNode("1:6", "Read more", "Space Grotesk", "Medium")],
          },
        ],
      },
      {
        id: "3:1",
        name: "Board",
        layoutMode: "NONE",
        children: [
          {
            id: "3:2",
            name: "Sticker",
            type: "RECTANGLE",
            x: 10,
            y: 20,
            width: 40,
            height: 40,
          },
        ],
      },
      {
        id: "9:1",
        name: "Row",
        layoutMode: "HORIZONTAL",
        children: ["A", "B", "C"].map((name, index) => ({
          id: `9:${index + 2}`,
          type: "RECTANGLE",
          name,
        })),
      },
      {
        id: "2:1",
        name: "Heading",
        type: "INSTANCE",
        layoutMode: "VERTICAL",
        mainComponent: main,
        componentProperties: {
          "Property 1": {
            type: "VARIANT",
            value: "Default",
          },
        },
        children: [
          {
            id: "I2:1;3:4",
            name: "Label box",
            layoutMode: "HORIZONTAL",
            children: [textNode("I2:1;3:5", "Search engine")],
          },
        ],
      },
      {
        id: "4:1",
        name: "Badge group",
        type: "GROUP",
        children: [
          {
            id: "4:2",
            name: "Dot",
            type: "ELLIPSE",
            width: 8,
            height: 8,
          },
        ],
      },
      {
        id: "5:1",
        name: "Area",
        type: "SECTION",
        children: [],
      },
      {
        id: "6:1",
        name: "Rule",
        type: "LINE",
        width: 100,
        height: 0,
      },
      {
        id: "6:2",
        name: "Divider",
        type: "LINE",
        width: 80,
        height: 0,
        rotation: 90,
      },
      {
        id: "8:1",
        name: "Photo",
        type: "RECTANGLE",
        width: 120,
        height: 80,
        fills: [
          {
            type: "IMAGE",
            visible: true,
            imageHash: "abc",
            scaleMode: "FIT",
          },
        ],
      },
      {
        id: "11:1",
        name: "Chip",
        type: "COMPONENT",
        layoutMode: "HORIZONTAL",
        children: [textNode("11:2", "Chip")],
      },
    ],
  });
}

/**
 * A fresh document for one design_apply: the page, the library's Heading set, the fonts it has. Returns the fake and
 * every node it knows, the created ones included, by id.
 */
export function applyDocument(options: FakeOptions = {}) {
  const library = headingSet();
  const root = page(library.children?.[0] as FakeNode);
  const fake = installFigma(
    root,
    {
      components: [library],
      fonts: [
        {
          family: "Inter",
          style: "Regular",
        },
        {
          family: "Inter",
          style: "Bold",
        },
        {
          family: "Space Grotesk",
          style: "Medium",
        },
      ],
    },
    options,
  );
  const all = (from: FakeNode): FakeNode[] => [from, ...(from.children ?? []).flatMap(all)];

  return {
    fake,
    root,
    library,
    nodes: () => [...all(root), ...all(library), ...fake.writes.created],
  };
}
