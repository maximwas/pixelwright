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

describe("variants_read after the review", () => {
  it("compares a state with the variant it differs from by that state alone", () => {
    const view = variantsView({
      root: {
        id: "6:1",
        name: "Button",
        type: "COMPONENT_SET",
        visible: true,
        x: 0,
        y: 0,
        width: 600,
        height: 200,
        childCount: 4,
        children: [
          variant("6:2", "Size=Small, State=Default", 0, 0, 0),
          variant("6:3", "Size=Small, State=Hover", 140, 0, 0.3),
          {
            ...variant("6:4", "Size=Large, State=Default", 0, 100, 0),
            width: 200,
          },
          {
            ...variant("6:5", "Size=Large, State=Hover", 140, 100, 0.3),
            width: 200,
          },
        ],
      },
      styles: {},
      variables: {},
    });
    const largeHover = view.variants.find((each) => each.id === "6:5");

    expect(largeHover).toMatchObject({
      pseudo: ":hover",
      against: {
        id: "6:4",
        name: "Size=Large, State=Default",
      },
      changed: [
        {
          path: "(root)",
          attributes: { background: ["#000", "#4D4D4D"] },
        },
      ],
    });
  });

  it("lists at most 50 variants, and says how many more", () => {
    const view = variantsView({
      root: {
        id: "7:1",
        name: "Icon",
        type: "COMPONENT_SET",
        visible: true,
        x: 0,
        y: 0,
        width: 6000,
        height: 40,
        childCount: 61,
        children: Array.from({ length: 61 }, (_, index) =>
          variant(`7:${index + 2}`, `Name=i${index}`, index * 50, 0, 0),
        ),
      },
      styles: {},
      variables: {},
    });

    expect(view.variants).toHaveLength(50);
    expect(view.more).toBe(10);
  });
});
