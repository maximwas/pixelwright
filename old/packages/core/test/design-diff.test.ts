import { describe, expect, it } from "vitest";
import { designDiff, type Snapshot, type SnapshotNode } from "../src/index.ts";
import { BOLD, type Run, textLayer } from "./helpers/layers.ts";

/** Two A/B screens as a client file has them: the same layout, one icon or one colour apart. */

const RED = {
  type: "SOLID",
  visible: true,
  color: {
    r: 1,
    g: 0,
    b: 0,
  },
};
const BLUE = {
  ...RED,
  color: {
    r: 0,
    g: 0,
    b: 1,
  },
};

const layer = (fields: Partial<SnapshotNode> & { id: string; name: string }): SnapshotNode => ({
  type: "RECTANGLE",
  visible: true,
  x: 0,
  y: 0,
  width: 40,
  height: 40,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const icon = (id: string, pathHash: string) =>
  layer({
    id,
    name: "flask",
    type: "VECTOR",
    fills: [RED],
    pathHash,
  });

const screen = (id: string, x: number, children: SnapshotNode[]): Snapshot => ({
  root: layer({
    id,
    name: `Screen ${id}`,
    type: "FRAME",
    x,
    width: 360,
    height: 640,
    layoutMode: "VERTICAL",
    children,
  }),
  styles: {},
  variables: {},
});

const variantA = () =>
  screen("10:1", 0, [
    layer({
      id: "10:2",
      name: "Card",
      fills: [RED],
    }),
    icon("10:3", "path-a"),
  ]);

describe("nodes_diff", () => {
  it("finds nothing between a screen and an equal one elsewhere, ids and the root's place aside", () => {
    const b = screen("20:1", 400, [
      layer({
        id: "20:2",
        name: "Card",
        fills: [RED],
      }),
      icon("20:3", "path-a"),
    ]);

    expect(designDiff(variantA(), b)).toEqual({
      same: true,
      onlyInA: [],
      onlyInB: [],
      changed: [],
    });
  });

  it("names a layer whose attribute changed, by its path, with both values", () => {
    const b = screen("20:1", 0, [
      layer({
        id: "20:2",
        name: "Card",
        fills: [BLUE],
      }),
      icon("20:3", "path-a"),
    ]);

    expect(designDiff(variantA(), b).changed).toEqual([
      {
        path: 'Rectangle "Card"',
        a: "10:2",
        b: "20:2",
        attributes: { background: ["#F00", "#00F"] },
      },
    ]);
  });

  it("tells an icon whose drawing differs though its name, size and src are the same", () => {
    const b = screen("20:1", 0, [
      layer({
        id: "20:2",
        name: "Card",
        fills: [RED],
      }),
      icon("20:3", "path-b"),
    ]);

    expect(designDiff(variantA(), b).changed).toEqual([
      {
        path: 'Icon "flask"',
        a: "10:3",
        b: "20:3",
        attributes: {},
        drawing: true,
      },
    ]);
  });

  it("does not call an icon drawn anew for what it says or does: a note, a link, an animation", () => {
    const b = screen("20:1", 0, [
      layer({
        id: "20:2",
        name: "Card",
        fills: [RED],
      }),
      {
        ...icon("20:3", "path-a"),
        annotations: [
          {
            label: "Spins while loading.",
          },
        ],
        href: "https://example.com",
        motion: {
          styles: [],
          tracks: [
            {
              field: "OPACITY",
              operation: "REPLACE",
              base: {
                type: "FLOAT",
                value: 1,
              },
              keyframes: [
                {
                  t: 0,
                  value: {
                    type: "FLOAT",
                    value: 0,
                  },
                  easing: {
                    type: "LINEAR",
                  },
                },
              ],
            },
          ],
        },
      },
    ]);

    expect(designDiff(variantA(), b).changed.filter(({ drawing }) => drawing === true)).toEqual([]);
  });

  it("lists the layers only one side has", () => {
    const b = screen("20:1", 0, [
      layer({
        id: "20:2",
        name: "Card",
        fills: [RED],
      }),
      layer({
        id: "20:4",
        name: "Badge",
      }),
    ]);
    const diff = designDiff(variantA(), b);

    expect(diff.onlyInA).toEqual([
      {
        path: 'Icon "flask"',
        id: "10:3",
      },
    ]);
    expect(diff.onlyInB).toEqual([
      {
        path: 'Rectangle "Badge"',
        id: "20:4",
      },
    ]);
    expect(diff.same).toBe(false);
  });

  it("compares a text's characters around its spans, and its spans in order as layers of the text", () => {
    const promo = (id: string, runs: readonly Run[]) => screen(`${id}:1`, 0, [textLayer(`${id}:2`, "Promo", runs)]);
    const diff = designDiff(
      promo("10", [["Save "], ["20%", BOLD], [" today"]]),
      promo("20", [["Save "], ["30%", BOLD], [" today"], ["!", BOLD]]),
    );

    expect(diff).toEqual({
      same: false,
      onlyInA: [],
      onlyInB: [
        {
          path: 'Text "Promo" / Span ""[2]',
          id: "",
        },
      ],
      changed: [
        {
          path: 'Text "Promo" / Span ""',
          a: "",
          b: "",
          attributes: { $text: ["20%", "30%"] },
        },
      ],
    });
  });
});
