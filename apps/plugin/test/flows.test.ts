import { describe, expect, it } from "vitest";
import { runOperation } from "../src/figma/operations.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

/** Two screens: Home's button goes to Detail with a smart animate, Detail's goes back; Home starts the flow. */
const prototype = () =>
  tree({
    id: "0:1",
    type: "PAGE",
    name: "App",
    flowStartingPoints: [
      {
        nodeId: "9:1",
        name: "Main",
      },
    ],
    children: [
      {
        id: "9:1",
        type: "FRAME",
        name: "Home",
        absoluteBoundingBox: {
          x: 0,
          y: 0,
          width: 375,
          height: 812,
        },
        children: [
          {
            id: "9:2",
            type: "INSTANCE",
            name: "Open",
            reactions: [
              {
                trigger: { type: "ON_CLICK" },
                actions: [
                  {
                    type: "NODE",
                    destinationId: "9:3",
                    navigation: "NAVIGATE",
                    transition: {
                      type: "SMART_ANIMATE",
                      duration: 0.3,
                      easing: { type: "EASE_OUT" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "9:3",
        type: "FRAME",
        name: "Detail",
        absoluteBoundingBox: {
          x: 500,
          y: 0,
          width: 375,
          height: 812,
        },
        children: [
          {
            id: "9:4",
            type: "INSTANCE",
            name: "Back",
            reactions: [
              {
                trigger: { type: "ON_CLICK" },
                actions: [{ type: "BACK" }],
              },
            ],
          },
        ],
      },
    ],
  });

describe("flow_read", () => {
  it("maps the prototype: where flows start, the screens, and which layer goes where, how", async () => {
    installFigma(prototype());

    const map = (await runOperation("flows", {})) as {
      page: string;
      starts: unknown[];
      screens: { id: string }[];
      links: unknown[];
    };

    expect(map.page).toBe("App");
    expect(map.starts).toEqual([
      {
        id: "9:1",
        name: "Main",
      },
    ]);
    expect(map.screens.map((screen) => screen.id)).toEqual(["9:1", "9:3"]);
    expect(map.links).toEqual([
      {
        from: {
          id: "9:1",
          name: "Home",
        },
        layer: {
          id: "9:2",
          name: "Open",
        },
        trigger: "ON_CLICK",
        action: "NAVIGATE",
        to: {
          id: "9:3",
          name: "Detail",
        },
        summary: expect.stringContaining("smart animate 300ms ease-out"),
      },
      {
        from: {
          id: "9:3",
          name: "Detail",
        },
        layer: {
          id: "9:4",
          name: "Back",
        },
        trigger: "ON_CLICK",
        action: "BACK",
        to: null,
        summary: expect.any(String),
      },
    ]);
  });
});
