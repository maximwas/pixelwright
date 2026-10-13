import { describe, expect, it } from "vitest";
import { designHints, fitDesign, type Snapshot, type SnapshotNode } from "../src/index.ts";
import { fixture } from "./helpers/fixtures.ts";

const layer = (fields: Partial<SnapshotNode> & { id: string }): SnapshotNode => ({
  name: `Layer ${fields.id}`,
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const snapshotOf = (root: SnapshotNode): Snapshot => ({
  root,
  styles: {},
  variables: {},
});

/** A landing page: 10 sections of 10 cards of 10 rows of 5 texts, about 5,600 layers. */
function landing(): SnapshotNode {
  let next = 0;
  const id = () => `9:${next++}`;
  const text = () =>
    layer({
      id: id(),
      type: "TEXT",
      name: "Copy",
      text: {
        characters: "Lorem ipsum dolor sit amet",
        textAutoResize: "WIDTH_AND_HEIGHT",
        textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP",
        segments: [],
      },
    });
  const row = () =>
    layer({
      id: id(),
      name: "Row",
      layoutMode: "HORIZONTAL",
      children: Array.from({ length: 5 }, text),
    });
  const card = () =>
    layer({
      id: id(),
      name: "Card",
      layoutMode: "VERTICAL",
      children: Array.from({ length: 10 }, row),
    });
  const section = () =>
    layer({
      id: id(),
      name: "Section",
      layoutMode: "HORIZONTAL",
      children: Array.from({ length: 10 }, card),
    });

  return layer({
    id: id(),
    name: "Landing",
    layoutMode: "VERTICAL",
    width: 1440,
    height: 8000,
    children: Array.from({ length: 10 }, section),
  });
}

describe("fitting a huge read into maxChars", () => {
  it("cuts the deepest branches first, keeps every section, and names what it cut", () => {
    const read = fitDesign(snapshotOf(landing()), 80_000);

    expect(read.xml.length).toBeLessThanOrEqual(80_000);
    expect(read.xml.match(/name="Section"/g)).toHaveLength(10);
    expect(read.xml.match(/name="Card"/g)).toHaveLength(100);
    expect(read.truncated.length).toBeGreaterThan(0);

    for (const id of read.truncated.slice(0, 20)) {
      expect(read.xml).toMatch(new RegExp(`id="${id}"[^>]*\\$truncated="true"/>`));
    }
  });

  it("leaves a read that fits untouched", () => {
    const row = fixture("orbit-plans");
    const read = fitDesign(row, 80_000);

    expect(read.truncated).toEqual([]);
    expect(read.xml).not.toContain("$truncated");
  });
});

describe("hints", () => {
  it("names a raw color that equals a token, and a layer left with Figma's default name", () => {
    const hints = designHints(fixture("orbit-customers"));

    expect(hints).toContainEqual(expect.stringMatching(/#FF6B3D .*color of 54:457.* equals --color-accent/));
    expect(hints).toContainEqual(
      `1 layer keeps Figma's default name (54:458 "Rectangle 1"): name it by its role in the code.`,
    );
  });

  it("counts several layers left with Figma's default names", () => {
    const hints = designHints(
      snapshotOf(
        layer({
          id: "1:1",
          name: "Card",
          layoutMode: "VERTICAL",
          children: [
            layer({
              id: "1:2",
              name: "Frame 12",
            }),
            layer({
              id: "1:3",
              name: "Rectangle 4",
            }),
          ],
        }),
      ),
    );

    expect(hints).toContainEqual(
      `2 layers keep Figma's default names (1:2 "Frame 12", 1:3 "Rectangle 4"): name the elements by their role in the code.`,
    );
  });

  it("points out a frame without auto layout and Figma's guess, a background rectangle, a bare wrapper, missing fonts and detached frames", () => {
    const hints = designHints(
      snapshotOf(
        layer({
          id: "1:1",
          name: "Hero",
          layoutMode: "VERTICAL",
          children: [
            layer({
              id: "1:2",
              name: "Stats",
              inferredLayout: {
                layoutMode: "HORIZONTAL",
                itemSpacing: 24,
              },
              children: [
                layer({
                  id: "1:3",
                  name: "Stat",
                }),
                layer({
                  id: "1:4",
                  name: "Stat",
                }),
              ],
            }),
            layer({
              id: "1:5",
              name: "Banner",
              layoutMode: "HORIZONTAL",
              children: [
                layer({
                  id: "1:6",
                  type: "RECTANGLE",
                  name: "Bg",
                  layoutPositioning: "ABSOLUTE",
                  fills: [
                    {
                      type: "SOLID",
                      color: {
                        r: 1,
                        g: 0.95,
                        b: 0.49,
                      },
                    },
                  ],
                }),
                layer({
                  id: "1:7",
                  type: "TEXT",
                  name: "Title",
                  missingFont: true,
                }),
              ],
            }),
            layer({
              id: "1:8",
              name: "Wrapper",
              children: [
                layer({
                  id: "1:9",
                  name: "Inner",
                  layoutMode: "VERTICAL",
                  detached: true,
                }),
              ],
            }),
          ],
        }),
      ),
    );

    expect(hints).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /no auto layout.*1:2 "Stats" with 2 children, Figma reads it as display: flex; gap: 24px/,
        ),
        expect.stringMatching(/rectangle covers.*1:6 "Bg" covers 1:5 "Banner".*background/),
        expect.stringMatching(/only wraps one layer.*1:8 "Wrapper" only wraps 1:9/),
        expect.stringMatching(/missing.*1:7/),
        expect.stringMatching(/detached from a component.*1:9 "Inner"/),
      ]),
    );
  });
});
