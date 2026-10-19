import { describe, expect, it } from "vitest";
import {
  type BindOutput,
  type ComponentEntry,
  componentStates,
  designLint,
  type Snapshot,
  type SnapshotNode,
  type TextSegment,
} from "../src/index.ts";

const solid = (hex: number) => ({
  type: "SOLID",
  visible: true,
  color: {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255,
  },
});

const layer = (id: string, name: string, fields: Partial<SnapshotNode> = {}): SnapshotNode => ({
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

const segment = (characters: string, color: number, styled = false): TextSegment => ({
  characters,
  start: 0,
  end: characters.length,
  fontName: {
    family: "Inter",
    style: "Regular",
  },
  fontSize: 14,
  fontWeight: 400,
  textDecoration: "NONE",
  textCase: "ORIGINAL",
  lineHeight: {
    unit: "PIXELS",
    value: 20,
  },
  letterSpacing: {
    unit: "PIXELS",
    value: 0,
  },
  fills: [solid(color)],
  fillStyleId: "",
  textStyleId: styled ? "S:body" : "",
});

const text = (id: string, characters: string, fields: Partial<SnapshotNode> & { color?: number } = {}) => {
  const { color = 0x14161f, ...rest } = fields;

  return layer(id, characters, {
    type: "TEXT",
    fills: [solid(color)],
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [segment(characters, color)],
    },
    ...rest,
  });
};

/** A pricing card breaking every rule once. */
const CARD = layer("1:1", "Card", {
  width: 400,
  height: 600,
  layoutMode: "VERTICAL",
  itemSpacing: 16,
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 13,
  fills: [solid(0xffffff)],
  fillStyleId: "S:paper",
  children: [
    text("1:2", "Pro", {
      x: 24,
      y: 13,
      color: 0xcccccc,
    }),
    text("1:3", "Free shipping on all orders over $50", {
      x: 24,
      y: 60,
      width: 420,
    }),
    layer("1:4", "Frame 12", {
      x: 24,
      y: 90,
      width: 352,
      children: [
        layer("1:5", "Icon", {
          type: "RECTANGLE",
          x: 24,
          y: 90,
          width: 20,
          fills: [solid(0x14161f)],
          fillStyleId: "S:ink",
        }),
        layer("1:6", "Label", {
          type: "RECTANGLE",
          x: 52,
          y: 90,
          fills: [solid(0x14161f)],
          fillStyleId: "S:ink",
        }),
      ],
      inferredLayout: {
        layoutMode: "HORIZONTAL",
        itemSpacing: 8,
      },
    }),
    layer("1:7", "Buy", {
      type: "INSTANCE",
      x: 24,
      y: 150,
      width: 80,
      height: 20,
      instance: {
        componentId: "C:btn-default",
        componentName: "State=Default",
        setId: "S:btn",
        setName: "Button",
        properties: {},
      },
      children: [
        layer("I1:7;2:1", "Background", {
          type: "RECTANGLE",
          x: 24,
          y: 150,
          width: 80,
          height: 20,
          overrides: ["fills", "characters"],
        }),
      ],
    }),
    layer("1:8", "Old card", {
      x: 24,
      y: 190,
      detached: true,
      effects: [
        {
          type: "DROP_SHADOW",
          visible: true,
          color: {
            r: 0,
            g: 0,
            b: 0,
            a: 0.2,
          },
          offset: {
            x: 0,
            y: 4,
          },
          radius: 12,
          spread: 0,
        },
      ],
    }),
    layer("1:9", "Spacer", {
      x: 24,
      y: 240,
      height: 0,
    }),
    layer("1:10", "Draft", {
      type: "RECTANGLE",
      visible: false,
    }),
  ],
});

const SNAPSHOT: Snapshot = {
  root: CARD,
  styles: {},
  variables: {},
};

const BIND: BindOutput = {
  bound: [
    {
      kind: "color",
      field: "color",
      value: "#14161F",
      token: "--ink",
      count: 1,
      examples: ["1:3"],
    },
    {
      kind: "number",
      field: "gap",
      value: "16px",
      token: "--space-4",
      count: 1,
      examples: ["1:1"],
    },
  ],
  ambiguous: [],
  unmatched: [],
  remapped: [],
  layers: 2,
  errors: [],
  notes: [],
  more: false,
};

const BUTTON: ComponentEntry = {
  id: "S:btn",
  key: "k",
  type: "COMPONENT_SET",
  name: "Button",
  page: "Components",
  remote: false,
  properties: {
    State: {
      type: "VARIANT",
      default: "Default",
      options: ["Default", "Hover"],
    },
  },
};

const lint = (options: Partial<Parameters<typeof designLint>[1]> = {}) =>
  designLint(
    {
      reads: [SNAPSHOT],
      bind: BIND,
      components: [BUTTON],
    },
    {
      limit: 100,
      scope: "the selection",
      ...options,
    },
  );

describe("design_lint: the general rules", () => {
  it("finds each rule's breach once, errors first, each with its layer and a fix naming a tool", () => {
    const { findings, summary } = lint();

    expect(findings.map(({ severity, rule, id }) => `${severity} ${rule} ${id}`)).toEqual([
      "error contrast 1:2",
      "warning raw-color 1:2",
      "warning text-style 1:2",
      "warning raw-color 1:3",
      "warning text-style 1:3",
      "warning overflow 1:3",
      "warning no-auto-layout 1:4",
      "warning touch-target 1:7",
      "warning detached 1:8",
      "info raw-number 1:1",
      "info off-scale 1:1",
      "info default-name 1:4",
      "info missing-states S:btn",
      "info overridden I1:7;2:1",
      "info effect-style 1:8",
      "info leftover 1:9",
      "info leftover 1:10",
    ]);
    expect(summary).toBe("17 findings in the selection: 1 errors, 8 warnings, 8 info.");
  });

  it("says which token binds a raw value, or that none holds it", () => {
    const { findings } = lint({ rules: ["raw-color", "raw-number"] });

    expect(findings.map(({ id, message, fix }) => `${id}: ${message} ${fix}`)).toEqual([
      "1:2: Raw color #CCC. No token holds #CCC: make it a token with tokens_apply, or snap it to a near one with tokens_bind choose.",
      "1:3: Raw color #14161F. tokens_bind binds it to --ink.",
      "1:1: Raw gap 16px. tokens_bind binds it to --space-4.",
    ]);
  });

  it("names how far a layer reaches past its parent's room, and what a component lacks", () => {
    const { findings } = lint({ rules: ["overflow", "missing-states", "touch-target", "no-auto-layout"] });

    expect(findings.map(({ message }) => message)).toEqual([
      '68px wider than the room 1:1 "Card" gives it.',
      "Places 2 children by hand; Figma reads them as display: flex; gap: 8px.",
      "80px × 20px: under the 24 px a pointer target needs (WCAG 2.5.8).",
      "A button with no focus, pressed, disabled states (it has default, hover).",
    ]);
  });

  it("leaves alone what a clipping frame cuts on purpose, a ticker's cards, but not a text it cuts", () => {
    const card = (id: string, x: number) =>
      layer(id, "Card", {
        x,
        width: 160,
      });
    const row = (id: string, name: string, clipsContent: boolean, children: SnapshotNode[]) =>
      layer(id, name, {
        width: 300,
        layoutMode: "HORIZONTAL",
        itemSpacing: 10,
        clipsContent,
        children,
      });
    const page = layer("3:0", "Page", {
      width: 300,
      height: 200,
      children: [
        row("3:1", "Ticker", true, [
          card("3:2", 0),
          card("3:3", 170),
          text("3:4", "Breaking news", {
            x: 340,
            width: 200,
          }),
        ]),
        row("3:5", "Row", false, [card("3:6", 0), card("3:7", 170)]),
      ],
    });
    const { findings } = designLint(
      {
        reads: [
          {
            root: page,
            styles: {},
            variables: {},
          },
        ],
      },
      {
        limit: 100,
        scope: "x",
        rules: ["overflow"],
      },
    );

    expect(findings.map(({ id, message }) => `${id}: ${message}`)).toEqual([
      '3:4: 240px wider than the room 3:1 "Ticker" gives it, which cuts it off.',
      '3:7: 30px wider than the room 3:5 "Row" gives it.',
    ]);
  });

  it("lists only what is at least as severe as asked, at most the limit", () => {
    const warnings = lint({
      severity: "warning",
      limit: 3,
    });

    expect(warnings.findings.map(({ rule }) => rule)).toEqual(["contrast", "raw-color", "text-style"]);
    expect(warnings.more).toBe(true);
    expect(warnings.rules.map(({ rule, count }) => `${rule} ${count}`)).toEqual([
      "contrast 1",
      "raw-color 2",
      "text-style 2",
      "detached 1",
      "no-auto-layout 1",
      "overflow 1",
      "touch-target 1",
    ]);
  });

  it("gives each rule the severity of its most severe finding, so the list and the findings agree", () => {
    const button = (id: string, height: number) =>
      layer(id, "Buy", {
        type: "INSTANCE",
        height,
        instance: {
          componentId: "C:btn",
          componentName: "Button",
          properties: {},
        },
      });
    const rulesOf = (...buttons: SnapshotNode[]) =>
      designLint(
        {
          reads: [
            {
              root: layer("4:0", "Bar", { children: buttons }),
              styles: {},
              variables: {},
            },
          ],
        },
        {
          limit: 100,
          scope: "x",
          rules: ["touch-target"],
        },
      ).rules.map(({ rule, severity, count }) => `${rule} ${severity} ${count}`);

    expect(rulesOf(button("4:1", 32), button("4:2", 40))).toEqual(["touch-target info 2"]);
    expect(rulesOf(button("4:1", 32), button("4:2", 20))).toEqual(["touch-target warning 2"]);
  });

  it("says a layer's raw values in one sentence, overrides in CSS words, and leaves a mask's colour alone", () => {
    const card = layer("2:1", "Promo", {
      fills: [solid(0x14161f), solid(0x123456)],
      children: [
        layer("2:2", "Mask", {
          type: "RECTANGLE",
          isMask: true,
          fills: [solid(0x000000)],
        }),
        layer("2:3", "Inner", {
          overrides: ["fills", "strokes", "strokeTopWeight", "characters"],
          fills: [],
        }),
      ],
    });
    const { findings } = designLint(
      {
        reads: [
          {
            root: card,
            styles: {},
            variables: {},
          },
        ],
        bind: {
          ...BIND,
          bound: [
            {
              kind: "color",
              field: "background",
              value: "#14161F",
              token: "--ink",
              count: 1,
              examples: ["2:1"],
            },
          ],
        },
      },
      {
        limit: 100,
        scope: "x",
        rules: ["raw-color", "overridden"],
      },
    );

    expect(findings.map(({ id, message, fix }) => `${id}: ${message} ${fix}`)).toEqual([
      "2:1: Raw background #14161F, background #123456. tokens_bind binds background #14161F to --ink. No token holds #123456: make it a token with tokens_apply, or snap it to a near one with tokens_bind choose.",
      "2:3: Overrides its component's background, border. Make it a property or a variant of the component, or take the overrides off (instances_reattach reset).",
    ]);
  });

  it("names the tool alone when tokens_bind could not run (an older plugin)", () => {
    const { findings } = designLint(
      { reads: [SNAPSHOT] },
      {
        limit: 100,
        scope: "x",
        rules: ["raw-color"],
      },
    );

    expect(findings[0]?.fix).toBe(
      "tokens_bind binds it to the token holding it, if one does; else make it a token with tokens_apply, or snap it to a near one with tokens_bind choose.",
    );
  });
});

describe("componentStates", () => {
  it("reads states from variant values and from properties named for a state", () => {
    expect(
      componentStates({
        name: "Text field",
        properties: {
          State: {
            type: "VARIANT",
            options: ["Default", "Focused", "Error"],
          },
          "Disabled#4:1": {
            type: "BOOLEAN",
            default: false,
          },
        },
      }),
    ).toEqual({
      kind: "field",
      present: ["default", "focus", "error", "disabled"],
      missing: ["hover"],
      properties: ["State", "Disabled"],
    });
  });

  it("is null for a component nobody presses", () => {
    expect(
      componentStates({
        name: "Avatar",
        properties: {},
      }),
    ).toBeNull();
  });
});
