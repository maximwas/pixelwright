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

describe("breakpoints_find's screens", () => {
  it("names the screen a layer is on and the page's other screens, with their children", async () => {
    installFigma(prototype());

    await expect(runOperation("screens", { node: "9:4" })).resolves.toEqual({
      target: {
        id: "9:3",
        name: "Detail",
        width: 375,
        height: 812,
        children: ["Back"],
      },
      screens: [
        {
          id: "9:1",
          name: "Home",
          width: 375,
          height: 812,
          children: ["Open"],
        },
      ],
    });
  });
});

describe("file_map", () => {
  it("lists every page with its frames, sections and what they hold, in one call", async () => {
    installFigma(prototype(), {
      pages: [
        tree({
          id: "0:2",
          type: "PAGE",
          name: "Components",
          children: [
            {
              id: "3:1",
              type: "SECTION",
              name: "Buttons",
              absoluteBoundingBox: {
                x: 0,
                y: 0,
                width: 600,
                height: 300,
              },
              children: [
                {
                  id: "3:2",
                  type: "COMPONENT_SET",
                  name: "Button",
                  absoluteBoundingBox: {
                    x: 20,
                    y: 20,
                    width: 300,
                    height: 100,
                  },
                },
              ],
            },
          ],
        }),
      ],
    });

    const map = (await runOperation("file_map", null)) as {
      pages: { name: string; current: boolean; nodes: { id: string; children?: { id: string }[] }[] }[];
      more: boolean;
    };

    expect(map.more).toBe(false);
    expect(map.pages.map((page) => [page.name, page.current, page.nodes.map((node) => node.id)])).toEqual([
      ["App", true, ["9:1", "9:3"]],
      ["Components", false, ["3:1"]],
    ]);
    expect(map.pages[1]?.nodes[0]?.children?.map((child) => child.id)).toEqual(["3:2"]);
  });
});

describe("file_map of a page with thousands of loose layers", () => {
  it("lists so many in all, with each page's own count, and says there is more", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        name: "Scraps",
        children: Array.from({ length: 1_600 }, (_, index) => ({
          id: `8:${index + 1}`,
          type: "RECTANGLE",
          name: `Rectangle ${index + 1}`,
        })),
      }),
    );

    const map = (await runOperation("file_map", null)) as {
      pages: { nodes: unknown[]; total?: number }[];
      more: boolean;
    };

    expect(map.pages[0]?.nodes).toHaveLength(1_500);
    expect(map.pages[0]?.total).toBe(1_600);
    expect(map.more).toBe(true);
  });
});

describe("screens on a page the user is not on", () => {
  it("loads the page before it looks for its screens", async () => {
    const installed = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [],
      }),
      {
        pages: [prototype()],
      },
    );

    await runOperation("screens", { node: "9:2" });

    expect(installed.writes.calls).toContainEqual(expect.objectContaining({ method: "loadAsync" }));
  });
});
