import { describe, expect, it } from "vitest";
import { designHints, designXml, type Snapshot, type SnapshotNode } from "../src/index.ts";

const frame = (id: string, fields: Partial<SnapshotNode> = {}): SnapshotNode => ({
  id,
  name: `Card ${id}`,
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  childCount: 0,
  layoutMode: "VERTICAL",
  paddingLeft: 16,
  ...fields,
});

const read = (...children: SnapshotNode[]): Snapshot => ({
  root: frame("1:1", {
    name: "Cards",
    childCount: children.length,
    children,
    paddingLeft: 0,
  }),
  styles: {},
  variables: {
    "V:16": {
      name: "space/16",
      collection: "Orbit",
      resolvedType: "FLOAT",
      remote: false,
      value: 16,
    },
    "V:0": {
      name: "space/0",
      collection: "Orbit",
      resolvedType: "FLOAT",
      remote: false,
      value: 0,
    },
  },
});

const hintsOf = (snapshot: Snapshot) => designHints(snapshot, designXml(snapshot));

describe("Figma's own variable match", () => {
  it("names the token Figma matches a raw spacing to, once for every layer using it", () => {
    const snapshot = read(
      frame("1:2", { inferred: { paddingLeft: "V:16" } }),
      frame("1:3", { inferred: { paddingLeft: "V:16" } }),
      frame("1:4", { inferred: { paddingLeft: "V:16" } }),
    );

    expect(hintsOf(snapshot)).toContainEqual(
      expect.stringMatching(
        /^padding 16px on 3 layers \(1:2 "Card 1:2"; 1:3 "Card 1:3"; 1:4 "Card 1:4"\) matches --space-16, Figma's own match for that field: use the token\.$/,
      ),
    );
  });

  it("never hints a width or a height, whatever Figma matched them to", () => {
    const hints = hintsOf(
      read(
        frame("1:2", {
          inferred: {
            height: "V:16",
            width: "V:16",
          },
        }),
      ),
    );

    expect(hints.join("\n")).not.toMatch(/matches --space-16/);
  });

  it("leaves out a zero, which every layout without a padding or a gap has", () => {
    const hints = hintsOf(
      read(
        frame("1:2", {
          paddingLeft: 0,
          itemSpacing: 0,
          inferred: {
            paddingLeft: "V:0",
            itemSpacing: "V:0",
          },
        }),
      ),
    );

    expect(hints.join("\n")).not.toMatch(/--space-0/);
  });
});
