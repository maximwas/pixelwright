import { describe, expect, it } from "vitest";
import { type SnapshotNode, variantsView } from "../src/index.ts";

const fill = (level: number) => [
  {
    type: "SOLID",
    visible: true,
    color: {
      r: level,
      g: level,
      b: level,
    },
  },
];

const variant = (id: string, name: string, x: number, y: number, level: number): SnapshotNode => ({
  id,
  name,
  type: "COMPONENT",
  visible: true,
  x,
  y,
  width: 120,
  height: 40,
  childCount: 0,
  layoutMode: "HORIZONTAL",
  fills: fill(level),
});

describe("variants_read", () => {
  it("compares each variant with the default, the top-left one, and names the pseudo-class a state suggests", () => {
    const view = variantsView({
      root: {
        id: "5:1",
        name: "Button",
        type: "COMPONENT_SET",
        visible: true,
        x: 0,
        y: 0,
        width: 400,
        height: 100,
        childCount: 3,
        children: [
          variant("5:3", "State=Hover", 140, 0, 0.3),
          variant("5:2", "State=Default", 0, 0, 0),
          variant("5:4", "State=Disabled", 280, 0, 0),
        ],
      },
      styles: {},
      variables: {},
    });

    expect(view.default).toEqual({
      id: "5:2",
      name: "State=Default",
    });
    expect(view.properties).toEqual({ State: ["Hover", "Default", "Disabled"] });
    expect(view.variants).toEqual([
      expect.objectContaining({
        id: "5:3",
        props: { State: "Hover" },
        pseudo: ":hover",
        changed: [
          expect.objectContaining({
            path: "(root)",
            attributes: { background: ["#000", "#4D4D4D"] },
          }),
        ],
      }),
      expect.objectContaining({
        id: "5:4",
        pseudo: ":disabled",
        same: true,
      }),
    ]);
  });
});
