import { describe, expect, it } from "vitest";
import { baselineDiff } from "../src/diff/baseline/baseline-diff.ts";
import type { RawTokens } from "../src/tokens/raw-tokens.ts";
import type { Snapshot, SnapshotNode } from "../src/types/snapshot.ts";
import { BOLD, layer, textLayer } from "./helpers/layers.ts";

const snap = (root: SnapshotNode, extra: Partial<Snapshot> = {}): Snapshot => ({
  root,
  styles: {},
  variables: {},
  ...extra,
});
const diff = (before: Snapshot, after: Snapshot, sameReader = true) =>
  baselineDiff(
    {
      snapshot: before,
      tokens: null,
    },
    {
      snapshot: after,
      tokens: null,
    },
    { sameReader },
  );
const text = (id: string, name: string) => textLayer(id, name, [[name]]);
const column = (id: string, name: string, children: SnapshotNode[], gap = 12) =>
  layer({
    id,
    name,
    layoutMode: "VERTICAL",
    itemSpacing: gap,
    children,
  });
const icon = (id: string, name: string, pathHash = "a1") =>
  layer({
    id,
    name,
    type: "VECTOR",
    width: 24,
    height: 24,
    pathHash,
    fills: [
      {
        type: "SOLID",
        color: {
          r: 0,
          g: 0,
          b: 0,
        },
      },
    ],
  });
const card = (id: string, gap = 12, title = "Plan") =>
  layer({
    id,
    name: `Card ${id}`,
    type: "INSTANCE",
    layoutMode: "VERTICAL",
    itemSpacing: 8,
    instance: {
      componentId: "C:1",
      componentName: "Plan Card",
      componentKey: "k",
      properties: {},
    },
    children: [column(`I${id};1`, "Body", [text(`I${id};2`, title), text(`I${id};3`, "Price")], gap)],
  });

describe("baselineDiff: layers", () => {
  const page = column("1:1", "Pricing", [column("1:2", "Plans", [text("1:3", "Title"), text("1:4", "Note")])]);

  it("finds nothing between a read and itself", () => {
    const result = diff(snap(page), snap(page));

    expect(result.same).toBe(true);
    expect(Object.values(result.changes).every((list) => list.length === 0)).toBe(true);
  });

  it("reports an attribute change and a rename by id, and the root's rename but not its place", () => {
    const after = column(
      "1:1",
      "Pricing v2",
      [column("1:2", "Plan list", [text("1:3", "Title"), text("1:4", "Note")], 8)],
      12,
    );
    const result = diff(
      snap(page),
      snap({
        ...after,
        x: 400,
      }),
    );

    expect(result.changes.changed.map(({ path, attributes }) => [path, Object.keys(attributes)])).toEqual([
      ["(root)", ["name"]],
      ['Frame "Plan list"', ["name", "gap"]],
    ]);
    expect(result.changes.added).toEqual([]);
    expect(result.changes.removed).toEqual([]);
  });

  it("says when the root moved to another page", () => {
    const result = diff(
      snap(page, {
        page: {
          id: "0:1",
          name: "Draft",
        },
      }),
      snap(page, {
        page: {
          id: "0:2",
          name: "Final",
        },
      }),
    );

    expect(result.changes.changed[0]?.attributes.$page).toEqual(["Draft", "Final"]);
  });

  it("lists a layer moved to another parent with where it was, and children in another order", () => {
    const after = column("1:1", "Pricing", [column("1:2", "Plans", [text("1:4", "Note")]), text("1:3", "Title")]);
    const reordered = column("1:1", "Pricing", [column("1:2", "Plans", [text("1:4", "Note"), text("1:3", "Title")])]);

    expect(diff(snap(page), snap(after)).changes.moved).toEqual([
      {
        path: 'Text "Title"',
        id: "1:3",
        from: 'Frame "Plans"',
      },
    ]);
    expect(diff(snap(page), snap(reordered)).changes.reordered).toEqual([
      {
        path: 'Frame "Plans"',
        id: "1:2",
        before: ['Text "Title"', 'Text "Note"'],
        after: ['Text "Note"', 'Text "Title"'],
      },
    ]);
  });

  it("pairs a layer made again by its tag and name, and a detached instance by its name", () => {
    const pasted = column("1:1", "Pricing", [column("1:2", "Plans", [text("9:9", "Title"), text("1:4", "Note")])]);
    const instance = column("1:1", "Page", [card("2:1")]);
    const detached = column("1:1", "Page", [
      {
        ...card("2:1"),
        id: "3:1",
        type: "FRAME",
        instance: undefined,
      } as SnapshotNode,
    ]);

    expect(diff(snap(page), snap(pasted)).changes.changed).toEqual([
      {
        path: 'Frame "Plans" / Text "Title"',
        id: "9:9",
        was: "1:3",
        tag: "Text",
        attributes: {},
      },
    ]);
    expect(diff(snap(page), snap(pasted)).changes.added).toEqual([]);
    expect(diff(snap(instance), snap(detached)).changes.changed[0]).toMatchObject({
      id: "3:1",
      was: "2:1",
      attributes: { $tag: ["Instance", "Frame"] },
    });
  });

  it("says a layer shown again was hidden, and a layer hidden now is removed, listing nothing under either", () => {
    const hidden = column("1:1", "Pricing", [
      {
        ...column("1:2", "Plans", [text("1:3", "Title")]),
        visible: false,
      },
    ]);
    const shown = column("1:1", "Pricing", [column("1:2", "Plans", [text("1:3", "Title")])]);

    expect(diff(snap(hidden), snap(shown)).changes.added).toEqual([
      expect.objectContaining({
        id: "1:2",
        was: "hidden",
      }),
    ]);
    expect(diff(snap(shown), snap(hidden)).changes.removed).toEqual([
      {
        path: 'Frame "Plans"',
        id: "1:2",
        tag: "Frame",
        now: "hidden",
      },
    ]);
  });

  it("gives a text's runs as its inner XML, and only the props that differ", () => {
    const before = column("1:1", "Page", [
      textLayer("1:2", "Footnote", [["Prices in USD."]]),
      {
        ...card("2:1"),
        instance: {
          componentId: "C:1",
          componentName: "Plan Card",
          properties: {
            "Price#1:0": {
              type: "TEXT",
              value: "$12",
            },
            "Plan#1:1": {
              type: "TEXT",
              value: "Pro, yearly",
            },
          },
        },
      },
    ]);
    const after = column("1:1", "Page", [
      textLayer("1:2", "Footnote", [["Prices in USD. "], ["Save 20%", BOLD]]),
      {
        ...card("2:1"),
        instance: {
          componentId: "C:1",
          componentName: "Plan Card",
          properties: {
            "Price#1:0": {
              type: "TEXT",
              value: "$14",
            },
            "Plan#1:1": {
              type: "TEXT",
              value: "Pro, yearly",
            },
          },
        },
      },
    ]);
    const [footnote, instance] = diff(snap(before), snap(after)).changes.changed;

    expect(footnote?.attributes.$text?.[1]).toContain("<Span");
    expect(instance?.attributes.props).toEqual(["Price=$12", "Price=$14"]);
  });
});

describe("baselineDiff: cuts and drawings", () => {
  it("compares a parent whose children were cut, on either side, but nothing under it", () => {
    const whole = column("1:1", "Page", [column("1:2", "List", [text("1:3", "A"), text("1:4", "B")])]);
    const cut = column("1:1", "Page", [
      {
        ...column("1:2", "List", [text("1:3", "A")]),
        childCount: 2,
      },
    ]);

    for (const [before, after] of [
      [whole, cut],
      [cut, whole],
    ] as const) {
      const result = diff(snap(before), snap(after));

      expect(result.changes.added).toEqual([]);
      expect(result.changes.removed).toEqual([]);
      expect(result.changes.notCompared).toEqual([
        {
          path: 'Frame "List"',
          id: "1:2",
          what: "children",
        },
      ]);
    }
  });

  it("marks an icon drawn anew, and renumbers nothing when an icon is added before it", () => {
    const before = column("1:1", "Page", [text("1:9", "Hi"), icon("1:2", "Arrow")]);
    const redrawn = column("1:1", "Page", [text("1:9", "Hi"), icon("1:2", "Arrow", "b2")]);
    const inserted = column("1:1", "Page", [text("1:9", "Hi"), icon("1:5", "Arrow"), icon("1:2", "Arrow")]);

    expect(diff(snap(before), snap(redrawn)).changes.changed).toEqual([
      expect.objectContaining({
        id: "1:2",
        drawing: true,
      }),
    ]);
    expect(diff(snap(before), snap(inserted)).changes.changed).toEqual([]);
    expect(diff(snap(before), snap(inserted)).changes.added.map(({ id }) => id)).toEqual(["1:5"]);
  });

  it("compares two plugin versions' reads of a drawing over the fields both hold", () => {
    const before = column("1:1", "Page", [text("1:9", "Hi"), icon("1:2", "Arrow")]);
    const newer = column("1:1", "Page", [
      text("1:9", "Hi"),
      {
        ...icon("1:2", "Arrow"),
        strokeCap: "ROUND",
      },
    ]);

    expect(diff(snap(before), snap(newer), false).changes.changed).toEqual([]);
    expect(diff(snap(before), snap(newer), true).changes.changed).toHaveLength(1);
  });

  it("carries an added layer's XML when it is short", () => {
    const before = column("1:1", "Page", [text("1:2", "Title")]);
    const after = column("1:1", "Page", [text("1:2", "Title"), text("1:3", "Trial")]);

    expect(diff(snap(before), snap(after)).changes.added[0]?.xml).toMatch(/^<Text id="1:3"/);
  });
});

describe("baselineDiff: components", () => {
  const cards = (gaps: number[]) =>
    column(
      "1:1",
      "Page",
      gaps.map((gap, index) => card(`2:${index + 1}`, gap)),
    );

  it("folds a change all instances share into one entry, and leaves a change in one instance where it is", () => {
    const all = diff(snap(cards([12, 12, 12])), snap(cards([8, 8, 8])));
    const two = diff(snap(cards([12, 12, 12])), snap(cards([8, 8, 12])));
    const one = diff(snap(cards([12, 12, 12])), snap(cards([8, 12, 12])));

    expect(all.changes.components).toEqual([
      {
        component: "Plan Card",
        path: 'Frame "Body"',
        change: "changed",
        attributes: { gap: ["12px", "8px"] },
        instances: ["2:1", "2:2", "2:3"],
        of: 3,
      },
    ]);
    expect(all.changes.changed).toEqual([]);
    expect(two.changes.components[0]).toMatchObject({
      instances: ["2:1", "2:2"],
      of: 3,
    });
    expect(one.changes.components).toEqual([]);
    expect(one.changes.changed.map(({ id }) => id)).toEqual(["I2:1;1"]);
  });
});

describe("baselineDiff: tokens", () => {
  const collection = {
    id: "VC:1",
    name: "Theme",
    remote: false,
    defaultModeId: "light",
    modes: [
      {
        modeId: "light",
        name: "Light",
      },
      {
        modeId: "dark",
        name: "Dark",
      },
    ],
  };
  const raw = (name: string, dark: string): RawTokens => ({
    collections: [collection],
    variables: [
      {
        id: "V:1",
        name,
        collectionId: "VC:1",
        resolvedType: "COLOR",
        scopes: [],
        valuesByMode: {
          light: {
            r: 0,
            g: 0,
            b: 1,
            a: 1,
          },
          dark: hex(dark),
        },
      },
    ],
    external: {},
    styles: [],
  });
  const swatch = (name: string) =>
    snap(
      column("1:1", "Page", [
        layer({
          id: "1:2",
          name: "Swatch",
          fills: [
            {
              type: "SOLID",
              color: {
                r: 0,
                g: 0,
                b: 1,
              },
              boundVariables: {
                color: {
                  type: "VARIABLE_ALIAS",
                  id: "V:1",
                },
              },
            },
          ],
        }),
        text("1:3", "Hi"),
      ]),
      {
        variables: {
          "V:1": {
            name,
            collection: "Theme",
            resolvedType: "COLOR",
            remote: false,
            value: {
              r: 0,
              g: 0,
              b: 1,
              a: 1,
            },
          },
        },
      },
    );
  const compare = (before: [string, string], after: [string, string]) =>
    baselineDiff(
      {
        snapshot: swatch(before[0]),
        tokens: raw(...before),
      },
      {
        snapshot: swatch(after[0]),
        tokens: raw(...after),
      },
      { sameReader: true },
    );

  it("reports a value changed in one mode, once, with the mode", () => {
    const result = compare(["color/brand", "#FFFFFF"], ["color/brand", "#EEEEEE"]);

    expect(result.changes.tokens).toEqual([
      {
        token: "--color-brand",
        name: "color/brand",
        mode: "Dark",
        before: "#FFF",
        after: "#EEE",
        layers: 1,
      },
    ]);
    expect(result.changes.changed).toEqual([]);
  });

  it("reports a renamed variable once, with what it was, and no attribute change on its layers", () => {
    const result = compare(["color/brand", "#FFFFFF"], ["color/primary", "#FFFFFF"]);

    expect(result.changes.tokens).toEqual([
      expect.objectContaining({
        token: "--color-primary",
        was: "color/brand",
      }),
    ]);
    expect(result.changes.changed).toEqual([]);
  });

  it("compares the reads' own token maps, with a note, when a side has no token values", () => {
    const result = baselineDiff(
      {
        snapshot: swatch("color/brand"),
        tokens: null,
      },
      {
        snapshot: swatch("color/brand"),
        tokens: raw("color/brand", "#FFFFFF"),
      },
      { sameReader: true },
    );

    expect(result.notes).toEqual([expect.stringContaining("the baseline has no token values")]);
  });
});

describe("baselineDiff: caps", () => {
  it("keeps each list to the cap and counts the rest", () => {
    const before = column("1:1", "Page", [text("1:2", "A")]);
    const after = column("1:1", "Page", [text("1:2", "A"), text("1:3", "B"), text("1:4", "C"), text("1:5", "D")]);
    const result = baselineDiff(
      {
        snapshot: snap(before),
        tokens: null,
      },
      {
        snapshot: snap(after),
        tokens: null,
      },
      {
        sameReader: true,
        cap: 2,
      },
    );

    expect(result.changes.added).toHaveLength(2);
    expect(result.counts.added).toBe(3);
    expect(result.more).toBe(1);
  });
});

function hex(value: string): { r: number; g: number; b: number; a: number } {
  const channel = (at: number) => Number.parseInt(value.slice(at, at + 2), 16) / 255;

  return {
    r: channel(1),
    g: channel(3),
    b: channel(5),
    a: 1,
  };
}

describe("baselineDiff: tokens only matched", () => {
  it("leaves out a variable Figma only matches a raw value to: no layer uses it", () => {
    const inferred = (id: string, value: string) =>
      snap(column("1:1", "Page", [text("1:2", "A"), text("1:3", "B")]), {
        variables: {
          [id]: {
            name: value,
            collection: "Space",
            resolvedType: "FLOAT",
            remote: false,
            value: Number.parseInt(value.split("/")[1] ?? "0", 10),
          },
        },
      });
    const before = inferred("V:12", "space/12");
    const after = inferred("V:8", "space/8");
    const raw = (snapshot: Snapshot): RawTokens => ({
      collections: [
        {
          id: "VC:s",
          name: "Space",
          remote: false,
          defaultModeId: "m",
          modes: [
            {
              modeId: "m",
              name: "Default",
            },
          ],
        },
      ],
      variables: Object.entries(snapshot.variables).map(([id, variable]) => ({
        id,
        name: variable.name,
        collectionId: "VC:s",
        resolvedType: "FLOAT",
        scopes: [],
        valuesByMode: { m: variable.value },
      })),
      external: {},
      styles: [],
    });
    const result = baselineDiff(
      {
        snapshot: before,
        tokens: raw(before),
      },
      {
        snapshot: after,
        tokens: raw(after),
      },
      { sameReader: true },
    );

    expect(result.changes.tokens).toEqual([]);
  });
});

describe("baselineDiff: review fixes", () => {
  it("compares the primitive a bound alias points to: changing it changes the design", () => {
    const blue = {
      r: 0,
      g: 0,
      b: 1,
      a: 1,
    };
    const red = {
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    };
    const one = (id: string, name: string) => ({
      id,
      name,
      remote: false,
      defaultModeId: id,
      modes: [
        {
          modeId: id,
          name: "Default",
        },
      ],
    });
    const raw = (primitive: typeof blue): RawTokens => ({
      collections: [one("VC:1", "Theme"), one("VC:2", "Brand")],
      variables: [
        {
          id: "V:1",
          name: "color/primary",
          collectionId: "VC:1",
          resolvedType: "COLOR",
          scopes: [],
          valuesByMode: {
            "VC:1": {
              type: "VARIABLE_ALIAS",
              id: "V:2",
            },
          },
        },
        {
          id: "V:2",
          name: "brand/500",
          collectionId: "VC:2",
          resolvedType: "COLOR",
          scopes: [],
          valuesByMode: { "VC:2": primitive },
        },
      ],
      external: {},
      styles: [],
    });
    const swatch = (color: typeof blue) =>
      snap(
        column("1:1", "Page", [
          layer({
            id: "1:2",
            name: "Swatch",
            fills: [
              {
                type: "SOLID",
                color: {
                  r: color.r,
                  g: color.g,
                  b: color.b,
                },
                boundVariables: {
                  color: {
                    type: "VARIABLE_ALIAS",
                    id: "V:1",
                  },
                },
              },
            ],
          }),
        ]),
        {
          variables: {
            "V:1": {
              name: "color/primary",
              collection: "Theme",
              resolvedType: "COLOR",
              remote: false,
              value: color,
            },
          },
        },
      );
    const result = baselineDiff(
      {
        snapshot: swatch(blue),
        tokens: raw(blue),
      },
      {
        snapshot: swatch(red),
        tokens: raw(red),
      },
      { sameReader: true },
    );

    expect(result.same).toBe(false);
    expect(result.changes.tokens).toEqual([
      {
        token: "--brand-500",
        name: "brand/500",
        before: "#00F",
        after: "#F00",
        layers: 1,
      },
    ]);
  });

  it("lists only the topmost layer made again, not every layer under it, when the ids changed", () => {
    const page = (offset: number) =>
      column(`${1 + offset}:1`, "Pricing", [
        column(`${1 + offset}:2`, "Plans", [text(`${1 + offset}:3`, "Title"), card(`${1 + offset}:4`)]),
      ]);
    const result = diff(snap(page(0)), snap(page(9000)));

    expect(
      result.changes.changed.map(({ path, id, was }) => ({
        path,
        id,
        was,
      })),
    ).toEqual([
      {
        path: "(root)",
        id: "9001:1",
        was: "1:1",
      },
    ]);
    expect(result.changes.components).toEqual([]);
  });
});

describe("baselineDiff: a branch cut on one side only", () => {
  const BLUE = {
    r: 0,
    g: 0,
    b: 1,
  };
  const raw: RawTokens = {
    collections: [
      {
        id: "VC:1",
        name: "Theme",
        remote: false,
        defaultModeId: "m",
        modes: [
          {
            modeId: "m",
            name: "Default",
          },
        ],
      },
    ],
    variables: [
      {
        id: "V:1",
        name: "color/brand",
        collectionId: "VC:1",
        resolvedType: "COLOR",
        scopes: [],
        valuesByMode: {
          m: {
            ...BLUE,
            a: 1,
          },
        },
      },
    ],
    external: {},
    styles: [],
  };
  /** The page with its Plans frame read whole, or cut by the read's budget (its two children left out). */
  const page = (cut: boolean): Snapshot => {
    const swatch = layer({
      id: "1:3",
      name: "Swatch",
      fills: [
        {
          type: "SOLID",
          color: BLUE,
          boundVariables: {
            color: {
              type: "VARIABLE_ALIAS",
              id: "V:1",
            },
          },
        },
      ],
    });
    const tile = layer({
      id: "1:4",
      name: "Tile",
      fillStyleId: "S:1",
      fills: [
        {
          type: "SOLID",
          color: BLUE,
        },
      ],
    });
    const plans = layer({
      id: "1:2",
      name: "Plans",
      childCount: 2,
      ...(cut ? {} : { children: [swatch, tile] }),
    });

    return snap(column("1:1", "Page", [plans, text("1:5", "Note")]), {
      styles: cut
        ? {}
        : {
            "S:1": {
              name: "Brand/Fill",
              type: "PAINT",
              remote: false,
              paints: [
                {
                  type: "SOLID",
                  color: BLUE,
                },
              ],
            },
          },
      variables: cut
        ? {}
        : {
            "V:1": {
              name: "color/brand",
              collection: "Theme",
              resolvedType: "COLOR",
              remote: false,
              value: {
                ...BLUE,
                a: 1,
              },
            },
          },
    });
  };

  it("leaves the tokens under the cut out of the comparison, with token values", () => {
    const result = baselineDiff(
      {
        snapshot: page(false),
        tokens: raw,
      },
      {
        snapshot: page(true),
        tokens: raw,
      },
      { sameReader: true },
    );

    expect(result.changes.tokens).toEqual([]);
    expect(result.same).toBe(true);
  });

  it("leaves them out of the reads' own token maps too, when a side has no token values", () => {
    const result = diff(page(false), page(true));

    expect(result.changes.tokens).toEqual([]);
    expect(result.same).toBe(true);
  });
});
