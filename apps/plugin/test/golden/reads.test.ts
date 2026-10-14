import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyDocument, textNode } from "../helpers/apply-document.ts";
import { FAKE_MIXED, type FakeNode, installFigma, tree } from "../helpers/fake-figma.ts";
import { testPlugin } from "../helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/**
 * What every read operation answers for a document, as the plugin before the read side's rewrite answers it: each call
 * on a fresh document, the answer kept whole (bytes as their length and SHA-1), or the error it threw.
 */

const BLACK = {
  r: 0,
  g: 0,
  b: 0,
};
const WHITE = {
  r: 1,
  g: 1,
  b: 1,
};

const solid = (color: typeof BLACK, extra: Record<string, unknown> = {}) => ({
  type: "SOLID",
  visible: true,
  opacity: 1,
  blendMode: "NORMAL",
  color,
  ...extra,
});
const alias = (id: string) => ({
  type: "VARIABLE_ALIAS",
  id,
});
const box = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
});

/** A text run as getStyledTextSegments gives it. */
const run = (characters: string, start: number, extra: Record<string, unknown> = {}) => ({
  characters,
  start,
  end: start + characters.length,
  fontName: {
    family: "Inter",
    style: "Regular",
  },
  fontSize: 16,
  fontWeight: 400,
  fontStyle: "REGULAR",
  textDecoration: "NONE",
  textCase: "ORIGINAL",
  lineHeight: { unit: "AUTO" },
  letterSpacing: {
    unit: "PIXELS",
    value: 0,
  },
  fills: [solid(BLACK)],
  fillStyleId: "",
  textStyleId: "",
  hyperlink: null,
  boundVariables: {},
  ...extra,
});

/** The Button set the page's instance comes from, on the page too. */
function buttonSet(): FakeNode {
  const variant = (id: string, size: string) => ({
    id,
    name: `Size=${size}`,
    type: "COMPONENT",
    key: `key-${id}`,
    layoutMode: "HORIZONTAL",
    children: [textNode(`${id}1`, "Go")],
  });
  const set = tree({
    id: "30:1",
    name: "Button",
    type: "COMPONENT_SET",
    key: "key-30:1",
    description: "A button",
    absoluteBoundingBox: box(0, 900, 300, 100),
    componentPropertyDefinitions: {
      Size: {
        type: "VARIANT",
        defaultValue: "Large",
        variantOptions: ["Large", "Small"],
      },
    },
    children: [variant("30:2", "Large"), variant("30:3", "Small")],
  });

  set.defaultVariant = set.children?.[0];

  return set;
}

/** The layers of the hero frame: a styled text, an instance, a mirrored mask, a vector, hidden and grid frames. */
function heroChildren(main: FakeNode) {
  return [
    {
      ...textNode("10:2", "Hello world"),
      absoluteBoundingBox: box(124, 232, 300, 40),
      textAutoResize: "HEIGHT",
      textAlignHorizontal: "CENTER",
      textTruncation: "ENDING",
      maxLines: 2,
      leadingTrim: "CAP_HEIGHT",
      hangingPunctuation: true,
      paragraphSpacing: 4,
      listSpacing: 2,
      hasMissingFont: false,
      segments: [
        run("Hello ", 0, { textStyleId: "S:body" }),
        run("world", 6, {
          hyperlink: {
            type: "URL",
            value: "https://pixelwright.dev",
          },
          boundVariables: { fontSize: alias("V:size") },
          fontWeight: 700,
        }),
      ],
    },
    {
      id: "10:3",
      name: "Button",
      type: "INSTANCE",
      absoluteBoundingBox: box(124, 280, 120, 40),
      layoutMode: "HORIZONTAL",
      mainComponent: main,
      componentProperties: {
        Size: {
          type: "VARIANT",
          value: "Large",
        },
        "Label#1:2": {
          type: "TEXT",
          value: "Go",
        },
        "Icon#1:3": {
          type: "BOOLEAN",
          value: true,
        },
      },
      overrides: [
        {
          id: "I10:3;30:21",
          overriddenFields: ["characters", "fills"],
        },
      ],
      children: [
        {
          ...textNode("I10:3;30:21", "Go"),
          componentPropertyReferences: { characters: "Label#1:2" },
        },
      ],
    },
    {
      id: "10:4",
      name: "Mask",
      type: "RECTANGLE",
      absoluteBoundingBox: box(130, 340, 40, 40),
      rotation: 30,
      relativeTransform: [
        [-1, 0, 30],
        [0, 1, 140],
      ],
      isMask: true,
      maskType: "ALPHA",
      fills: [solid(BLACK)],
    },
    {
      id: "10:5",
      name: "Arrow",
      type: "VECTOR",
      absoluteBoundingBox: box(180, 340, 24, 24),
      vectorPaths: [
        {
          windingRule: "NONZERO",
          data: "M 0 0 L 10 10 Z",
        },
      ],
      strokes: [solid(BLACK)],
      strokeWeight: 2,
      strokeAlign: "CENTER",
      strokeCap: "ROUND",
      absoluteRenderBounds: box(179, 339, 26, 26),
    },
    {
      id: "10:6",
      name: "Hidden",
      visible: false,
      absoluteBoundingBox: box(124, 380, 40, 40),
      children: [
        {
          id: "10:7",
          name: "Inside hidden",
          type: "RECTANGLE",
        },
      ],
    },
    {
      id: "10:8",
      name: "Grid",
      layoutMode: "GRID",
      gridRowCount: 1,
      gridColumnCount: 2,
      gridRowGap: 8,
      gridColumnGap: 12,
      gridRowSizes: [
        {
          type: "FLEX",
          value: 1,
        },
      ],
      gridColumnSizes: [
        {
          type: "FIXED",
          value: 80,
        },
        {
          type: "FLEX",
          value: 1,
        },
      ],
      absoluteBoundingBox: box(124, 430, 300, 60),
      children: [
        {
          id: "10:10",
          name: "Cell",
          type: "RECTANGLE",
          gridRowAnchorIndex: 0,
          gridColumnAnchorIndex: 1,
          gridRowSpan: 1,
          gridColumnSpan: 1,
          gridChildHorizontalAlign: "AUTO",
          gridChildVerticalAlign: "CENTER",
        },
      ],
    },
    {
      ...textNode("10:11", "Docs"),
      absoluteBoundingBox: box(124, 500, 40, 20),
      reactions: [
        {
          trigger: { type: "ON_CLICK" },
          actions: [
            {
              type: "URL",
              url: "https://pixelwright.dev/docs",
            },
          ],
        },
      ],
    },
    {
      id: "10:12",
      name: "Loose row",
      layoutMode: "NONE",
      absoluteBoundingBox: box(124, 530, 200, 40),
      inferredAutoLayout: {
        layoutMode: "HORIZONTAL",
        itemSpacing: 12,
        primaryAxisAlignItems: "MIN",
        counterAxisAlignItems: "CENTER",
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      },
      children: [],
    },
  ];
}

/** The hero frame: auto layout, every paint, stroke, effect, corner, token and note field a snapshot reads. */
function hero(main: FakeNode) {
  return {
    id: "10:1",
    name: "Hero",
    absoluteBoundingBox: box(100, 200, 600, 400),
    absoluteRenderBounds: box(96, 200, 608, 410),
    devStatus: { type: "READY_FOR_DEV" },
    layoutMode: "VERTICAL",
    layoutWrap: "NO_WRAP",
    primaryAxisAlignItems: "CENTER",
    counterAxisAlignItems: "MIN",
    counterAxisAlignContent: "AUTO",
    itemSpacing: 24,
    counterAxisSpacing: 0,
    paddingTop: 32,
    paddingRight: 24,
    paddingBottom: 32,
    paddingLeft: 24,
    itemReverseZIndex: false,
    strokesIncludedInLayout: false,
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "HUG",
    layoutPositioning: "AUTO",
    layoutGrow: 0,
    layoutAlign: "INHERIT",
    minWidth: 320,
    maxWidth: null,
    opacity: 0.9,
    blendMode: "MULTIPLY",
    clipsContent: true,
    constraints: {
      horizontal: "CENTER",
      vertical: "MIN",
    },
    fills: [
      solid(WHITE),
      {
        type: "GRADIENT_LINEAR",
        visible: true,
        opacity: 1,
        blendMode: "NORMAL",
        gradientStops: [
          {
            position: 0,
            color: {
              ...BLACK,
              a: 1,
            },
          },
          {
            position: 1,
            color: {
              ...WHITE,
              a: 1,
            },
          },
        ],
        gradientTransform: [
          [1, 0, 0],
          [0, 1, 0],
        ],
      },
    ],
    strokes: [solid(BLACK)],
    strokeWeight: FAKE_MIXED,
    strokeTopWeight: 1,
    strokeRightWeight: 0,
    strokeBottomWeight: 2,
    strokeLeftWeight: 0,
    strokeAlign: "INSIDE",
    strokeCap: "NONE",
    dashPattern: [4, 2],
    effects: [
      {
        type: "DROP_SHADOW",
        visible: true,
        radius: 8,
        spread: 0,
        offset: {
          x: 0,
          y: 4,
        },
        color: {
          ...BLACK,
          a: 0.25,
        },
        blendMode: "NORMAL",
        showShadowBehindNode: false,
      },
    ],
    cornerRadius: FAKE_MIXED,
    topLeftRadius: 8,
    topRightRadius: 8,
    bottomRightRadius: 0,
    bottomLeftRadius: 0,
    cornerSmoothing: 0.6,
    fillStyleId: "S:surface",
    strokeStyleId: "",
    effectStyleId: "S:shadow",
    gridStyleId: "",
    boundVariables: { itemSpacing: alias("V:gap") },
    inferredVariables: {
      paddingTop: [alias("V:space")],
      paddingLeft: [alias("V:space"), alias("V:gap")],
    },
    layoutGrids: [
      {
        pattern: "COLUMNS",
        alignment: "STRETCH",
        gutterSize: 16,
        count: 4,
        offset: 0,
        visible: true,
      },
    ],
    exportSettings: [
      {
        format: "PNG",
        suffix: "",
        constraint: {
          type: "SCALE",
          value: 2,
        },
      },
    ],
    reactions: [
      {
        trigger: { type: "ON_CLICK" },
        actions: [
          {
            type: "NODE",
            destinationId: "10:9",
            navigation: "NAVIGATE",
            transition: null,
          },
        ],
      },
    ],
    annotations: [
      {
        label: "Hero note",
        categoryId: "C:1",
        properties: [{ type: "width" }],
      },
      { label: "" },
    ],
    css: {
      display: "flex",
      background: "linear-gradient(#000, #fff)",
    },
    children: heroChildren(main),
  };
}

/** The reads document: the hero, its prototype destination, a component, the Button set, a section of screens. */
function readsDocument() {
  const set = buttonSet();
  const page = tree({
    id: "0:1",
    name: "Page 1",
    type: "PAGE",
    flowStartingPoints: [
      {
        nodeId: "10:1",
        name: "Main flow",
      },
    ],
    children: [
      hero(set.children?.[0] as FakeNode),
      {
        id: "10:9",
        name: "Detail",
        absoluteBoundingBox: box(800, 200, 600, 400),
        children: [],
      },
      {
        id: "20:1",
        name: "Chip",
        type: "COMPONENT",
        key: "key-20:1",
        description: "A small label",
        absoluteBoundingBox: box(0, 700, 80, 24),
        children: [textNode("20:2", "Chip")],
      },
      {
        id: "40:1",
        name: "Screens",
        type: "SECTION",
        absoluteBoundingBox: box(0, 1200, 1600, 900),
        children: [
          {
            id: "40:2",
            name: "Home",
            absoluteBoundingBox: box(0, 1200, 1440, 900),
            children: [],
          },
        ],
      },
    ],
  });

  page.children?.push(set);
  set.parent = page;

  const fake = installFigma(page, {
    styles: {
      "S:surface": {
        id: "S:surface",
        name: "Surface",
        type: "PAINT",
        remote: false,
        paints: [solid(WHITE)],
      },
      "S:shadow": {
        id: "S:shadow",
        name: "Shadow/Card",
        type: "EFFECT",
        remote: false,
        effects: [],
      },
      "S:body": {
        id: "S:body",
        name: "Body",
        type: "TEXT",
        remote: false,
        fontName: {
          family: "Inter",
          style: "Regular",
        },
        fontSize: 16,
        lineHeight: { unit: "AUTO" },
        letterSpacing: {
          unit: "PIXELS",
          value: 0,
        },
        textCase: "ORIGINAL",
        textDecoration: "NONE",
      },
    },
    variables: {
      "V:gap": {
        name: "space/gap",
        variableCollectionId: "VC:1",
        resolvedType: "FLOAT",
        value: 24,
        valuesByMode: { "VC:1/m1": 24 },
      },
      "V:space": {
        name: "space/32",
        variableCollectionId: "VC:1",
        resolvedType: "FLOAT",
        value: 32,
        valuesByMode: { "VC:1/m1": 32 },
      },
      "V:size": {
        name: "type/size",
        variableCollectionId: "VC:1",
        resolvedType: "FLOAT",
        value: 16,
        valuesByMode: { "VC:1/m1": 16 },
      },
    },
    collections: {
      "VC:1": {
        id: "VC:1",
        name: "Tokens",
        defaultModeId: "VC:1/m1",
        modes: [
          {
            modeId: "VC:1/m1",
            name: "Light",
          },
        ],
      },
    },
    categories: [
      {
        id: "C:1",
        label: "Development",
        color: "blue",
      },
    ],
    fonts: [
      {
        family: "Inter",
        style: "Regular",
      },
    ],
  });

  return fake;
}

/** A layer's bytes for export, the same every time, and the original image behind a hash. */
const EXPORTED = new Uint8Array(Array.from({ length: 300 }, (_, index) => index % 251));

function withBytes(fake: ReturnType<typeof readsDocument>): void {
  for (const id of ["10:4", "10:5"]) {
    const node = fake.figma.currentPage.findAll?.((layer) => layer.id === id)[0];

    if (node !== undefined) {
      node.exportAsync = async () => EXPORTED;
    }
  }

  Object.assign(fake.figma, {
    base64Encode: (bytes: Uint8Array) => Buffer.from(bytes).toString("base64"),
    getImageByHash: (hash: string) => (hash === "a".repeat(40) ? { getBytesAsync: async () => EXPORTED } : null),
  });
}

interface ReadCase {
  readonly name: string;
  readonly op: string;
  readonly input: unknown;
  /** The apply document instead of the reads document. */
  readonly apply?: boolean;
  readonly selection?: readonly string[];
}

const GROUPS: Readonly<Record<string, readonly ReadCase[]>> = {
  snapshot: [
    {
      name: "the hero",
      op: "snapshot",
      input: { node: "10:1" },
    },
    {
      name: "the hero with Figma's CSS for all",
      op: "snapshot",
      input: {
        node: "10:1",
        css: "all",
      },
    },
    {
      name: "the hero with Figma's CSS where unmapped",
      op: "snapshot",
      input: {
        node: "10:1",
        css: "unmapped",
      },
    },
    {
      name: "the hero one level deep",
      op: "snapshot",
      input: {
        node: "10:1",
        depth: 1,
      },
    },
    {
      name: "a vector with its paths",
      op: "snapshot",
      input: {
        node: "10:5",
        paths: true,
      },
    },
    {
      name: "the instance's text",
      op: "snapshot",
      input: { node: "I10:3;30:21" },
    },
    {
      name: "the apply document's card",
      op: "snapshot",
      input: { node: "1:1" },
      apply: true,
    },
    {
      name: "a page",
      op: "snapshot",
      input: { node: "0:1" },
    },
    {
      name: "a missing layer",
      op: "snapshot",
      input: { node: "99:9" },
    },
  ],
  entries: [
    {
      name: "layers inside one another, hidden, and missing",
      op: "entries",
      input: { ids: ["10:2", "10:1", "10:6", "99:9"] },
    },
    {
      name: "a layer in a hidden frame",
      op: "entries",
      input: { ids: ["10:7", "10:3"] },
    },
  ],
  nodes: [
    {
      name: "the selection",
      op: "selection",
      input: null,
      selection: ["10:2", "10:4"],
    },
    {
      name: "show one layer",
      op: "show",
      input: { node: "10:2" },
    },
    {
      name: "show two layers at a zoom without selecting",
      op: "show",
      input: {
        nodes: ["10:2", "10:4"],
        zoom: 2,
        select: false,
      },
    },
    {
      name: "the viewport",
      op: "viewport",
      input: null,
    },
    {
      name: "find by name",
      op: "find",
      input: { name: "Hero" },
    },
    {
      name: "find texts",
      op: "find",
      input: { type: "TEXT" },
    },
    {
      name: "find by text inside a layer",
      op: "find",
      input: {
        text: "world",
        within: "10:1",
      },
    },
    {
      name: "find instances of a component",
      op: "find",
      input: { component: "Button" },
    },
    {
      name: "the hero's outline",
      op: "outline",
      input: {
        node: "10:1",
        depth: 2,
      },
    },
    {
      name: "the pages",
      op: "outline",
      input: { node: "0:0" },
    },
    {
      name: "the current page",
      op: "outline",
      input: {},
    },
    {
      name: "the apply document's page",
      op: "outline",
      input: { depth: 4 },
      apply: true,
    },
    {
      name: "the set of an instance",
      op: "set_of",
      input: { node: "10:3" },
    },
    {
      name: "the set of a variant",
      op: "set_of",
      input: { node: "30:2" },
    },
    {
      name: "the set of a text",
      op: "set_of",
      input: { node: "10:2" },
    },
  ],
  flows: [
    {
      name: "the screens of a section",
      op: "screens",
      input: { node: "40:1" },
    },
    {
      name: "the screens around a frame",
      op: "screens",
      input: { node: "40:2" },
    },
    {
      name: "the flows of the page",
      op: "flows",
      input: {},
    },
    {
      name: "the file map",
      op: "file_map",
      input: null,
    },
    {
      name: "the apply document's map",
      op: "file_map",
      input: null,
      apply: true,
    },
  ],
  components: [
    {
      name: "local components",
      op: "components",
      input: { scope: "local" },
    },
    {
      name: "used components",
      op: "components",
      input: {},
    },
    {
      name: "used in the hero",
      op: "components",
      input: { within: "10:1" },
    },
    {
      name: "used in the apply document",
      op: "components",
      input: {},
      apply: true,
    },
  ],
  inspect: [
    {
      name: "the hero and its layers, from the hero",
      op: "inspect",
      input: {
        nodes: ["10:1", "10:2", "10:4", "10:5"],
        relativeTo: "10:1",
      },
    },
    {
      name: "a text and a grid cell, from the page",
      op: "inspect",
      input: { nodes: ["10:11", "10:10"] },
    },
  ],
  tokens: [
    {
      name: "the tokens used",
      op: "variables",
      input: {},
    },
    {
      name: "the file's own tokens",
      op: "variables",
      input: { used: false },
    },
    {
      name: "a paint style's use",
      op: "usage",
      input: { token: "--Surface" },
    },
    {
      name: "a variable's use",
      op: "usage",
      input: { token: "--space-gap" },
    },
  ],
  export: [
    {
      name: "a layer as PNG",
      op: "export",
      input: {
        node: "10:4",
        format: "PNG",
        scale: 2,
      },
    },
    {
      name: "a layer as SVG, its second chunk",
      op: "export",
      input: {
        node: "10:5",
        format: "SVG",
        offset: 100,
        length: 100,
      },
    },
    {
      name: "an original image",
      op: "image",
      input: { hash: "a".repeat(40) },
    },
    {
      name: "an image the file does not have",
      op: "image",
      input: { hash: "b".repeat(40) },
    },
  ],
};

/** A value as JSON keeps it: numbers to 1e-9, bytes as their length and SHA-1, no functions. */
function plain(value: unknown): unknown {
  if (typeof value === "number") {
    return Math.round(value * 1e9) / 1e9;
  }

  if (typeof value === "symbol") {
    return String(value);
  }

  if (value instanceof Uint8Array) {
    return {
      bytes: value.length,
      sha1: createHash("sha1").update(value).digest("hex"),
    };
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => plain(item));
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => typeof item !== "function")
      .map(([key, item]) => [key, plain(item)]),
  );
}

async function answerOf(testCase: ReadCase) {
  const fake = testCase.apply ? applyDocument().fake : readsDocument();

  withBytes(fake);

  if (testCase.selection !== undefined) {
    const chosen = new Set(testCase.selection);

    fake.figma.currentPage.selection = fake.figma.currentPage.findAll?.((layer) => chosen.has(layer.id)) ?? [];
  }

  const answer = await plugin.run(testCase.op, testCase.input).then(
    (result) => ({ result: plain(result) }),
    (error: unknown) => ({
      thrown: {
        ...(error instanceof Error && "code" in error ? { code: error.code } : {}),
        message: error instanceof Error ? error.message : String(error),
      },
    }),
  );

  return {
    ...answer,
    ...(fake.state.zoomedTo.length === 0 ? {} : { zoomedTo: fake.state.zoomedTo.map((node) => node.id) }),
  };
}

describe.each(Object.keys(GROUPS))("golden reads (%s)", (group) => {
  it("keeps what each read answers", async () => {
    const record: Record<string, unknown> = {};

    for (const testCase of GROUPS[group] ?? []) {
      record[testCase.name] = await answerOf(testCase);
    }

    await expect(`${JSON.stringify(record, null, 2)}\n`).toMatchFileSnapshot(`__golden__/reads/${group}.json`);
  });
});
