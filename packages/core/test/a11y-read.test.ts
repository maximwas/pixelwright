import { describe, expect, it } from "vitest";
import { a11yRead, type Snapshot, type SnapshotNode, type TextSegment } from "../src/index.ts";

const node = (id: string, name: string, fields: Partial<SnapshotNode> = {}): SnapshotNode => ({
  id,
  name,
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const segment = (characters: string, size: number, weight: number, styleId = ""): TextSegment => ({
  characters,
  start: 0,
  end: characters.length,
  fontName: {
    family: "Inter",
    style: weight >= 700 ? "Bold" : "Regular",
  },
  fontSize: size,
  fontWeight: weight,
  textDecoration: "NONE",
  textCase: "ORIGINAL",
  lineHeight: { unit: "AUTO" },
  letterSpacing: {
    unit: "PIXELS",
    value: 0,
  },
  fills: [],
  fillStyleId: "",
  textStyleId: styleId,
});

const text = (id: string, characters: string, size = 16, weight = 400, fields: Partial<SnapshotNode> = {}) =>
  node(id, characters, {
    type: "TEXT",
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [segment(characters, size, weight, (fields as { styleId?: string }).styleId)],
    },
    ...fields,
  });

const instance = (id: string, name: string, component: string, fields: Partial<SnapshotNode> = {}) =>
  node(id, name, {
    type: "INSTANCE",
    instance: {
      componentId: `${id}-main`,
      componentName: "Default",
      setName: component,
      properties: {},
    },
    ...fields,
  });

const click = (action: Record<string, unknown>) => [
  {
    trigger: { type: "ON_CLICK" },
    actions: [action],
  },
];

const PHOTO = [
  {
    type: "IMAGE",
    visible: true,
    imageHash: "a".repeat(40),
    scaleMode: "FILL",
  },
];

const SCREEN = node("1:1", "Pricing", {
  width: 1440,
  height: 900,
  layoutMode: "VERTICAL",
  children: [
    text("1:2", "Pricing", 48, 700),
    text("1:3", "Plans for every team", 24, 600),
    text("1:22", "$29", 48, 700),
    text("1:4", "Pick the plan that fits, change it any time.", 16),
    text("1:5", "All plans include unlimited projects.", 16),
    text("1:6", "Billing", 20, 600, { styleId: "S:h4" } as Partial<SnapshotNode>),
    instance("1:7", "Get started", "Button", {
      reactions: click({
        type: "NODE",
        navigation: "NAVIGATE",
        destinationName: "Checkout",
      }) as never,
      children: [text("1:8", "Get started", 15, 600)],
    }),
    instance("1:9", "Close", "Icon Button", {
      width: 32,
      height: 32,
      reactions: click({
        type: "CLOSE",
      }) as never,
      children: [
        node("1:10", "x", {
          type: "VECTOR",
          width: 16,
          height: 16,
        }),
      ],
    }),
    node("1:11", "Email row", {
      layoutMode: "VERTICAL",
      children: [
        text("1:12", "Email address", 14, 500),
        instance("1:13", "Email", "Text field", { children: [text("1:14", "you@company.com", 16)] }),
      ],
    }),
    instance("1:15", "Promo code", "Text field", { children: [text("1:16", "Code", 16)] }),
    node("1:17", "Hero photo", {
      type: "RECTANGLE",
      fills: PHOTO as never,
    }),
    node("1:18", "Rectangle 22", {
      type: "RECTANGLE",
      fills: PHOTO as never,
    }),
    node("1:19", "Footer", {
      children: [text("1:20", "© 2026 Orbit", 14, 400, { y: 60 }), text("1:21", "Terms", 14, 400, { y: 0 })],
    }),
  ],
});

const READ: Snapshot = {
  root: SCREEN,
  styles: {
    "S:h4": {
      name: "Heading/H4",
      type: "TEXT",
      remote: false,
    },
  },
  variables: {},
};

describe("a11y_read: what the markup needs", () => {
  const read = a11yRead(READ);

  it("ranks headings by size, a style's name before it, the body size and texts without letters (a price) left out", () => {
    expect(read.headings.map(({ id, level, from }) => `${id} h${level} ${from}`)).toEqual([
      "1:2 h1 size",
      "1:3 h2 size",
      "1:6 h4 style",
    ]);
  });

  it("gives each control its role and the label its text gives, or says one is needed", () => {
    expect(read.controls.map(({ id, role, label }) => `${id} ${role} ${label ?? "(none)"}`)).toEqual([
      "1:7 link Get started",
      "1:9 button (none)",
      "1:13 textbox Email address",
      "1:15 textbox (none)",
    ]);
    expect(read.controls[0]?.why).toBe("a click goes to Checkout");
    expect(read.controls[1]?.suggestion).toBe('aria-label "Close"');
  });

  it("asks an alt for each picture, named from its layer unless that is Figma's default", () => {
    expect(read.images).toEqual([
      {
        id: "1:17",
        name: "Hero photo",
        alt: "Hero photo",
        decorative: false,
      },
      {
        id: "1:18",
        name: "Rectangle 22",
        alt: null,
        decorative: false,
      },
    ]);
  });

  it("says where layers placed by hand read in another order than they show", () => {
    expect(read.order).toEqual([
      '1:19 "Footer" shows 1:21 "Terms" before 1:20 "© 2026 Orbit", but its layers list them the other way: order them as they read.',
    ]);
  });

  it("sums up what to fix", () => {
    expect(read.notes).toEqual([
      "Heading levels skip from h2 to h4: use h3, or style the text as a heading of its place.",
      "1 control has no label: give it an aria-label (suggested).",
      "1 field has no label next to it: give it a visible label or an aria-label.",
      "1 picture has no name to make an alt from: describe what it shows, or mark it decorative.",
    ]);
  });
});
