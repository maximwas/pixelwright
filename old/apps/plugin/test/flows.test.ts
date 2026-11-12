import { describe, expect, it } from "vitest";
import { FIGMA_OFFLINE, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

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

    const map = (await plugin.run("flows", {})) as {
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

    await expect(plugin.run("screens", { node: "9:4" })).resolves.toEqual({
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

    const map = (await plugin.run("file_map", null)) as {
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

describe("file_map while Figma cannot load a page", () => {
  it("lists every page, gives the layers of those it loaded, and names the other with Figma's words", async () => {
    installFigma(prototype(), {
      pages: [
        tree({
          id: "0:2",
          type: "PAGE",
          name: "Community",
          children: [
            {
              id: "4:1",
              name: "Cover",
            },
          ],
        }),
        tree({
          id: "0:3",
          type: "PAGE",
          name: "Components",
          children: [
            {
              id: "3:1",
              name: "Button",
            },
          ],
        }),
      ],
      unloadablePages: ["0:2"],
    });

    const map = (await plugin.run("file_map", null)) as {
      pages: { id: string; name: string; current: boolean; nodes?: { id: string }[] }[];
      more: boolean;
      pagesNotRead?: unknown;
    };

    expect(map.pages.map(({ id, name, nodes }) => [id, name, nodes?.map((node) => node.id)])).toEqual([
      ["0:1", "App", ["9:1", "9:3"]],
      ["0:2", "Community", undefined],
      ["0:3", "Components", ["3:1"]],
    ]);
    expect(map.pages[1]).toEqual({
      id: "0:2",
      name: "Community",
      current: false,
    });
    expect(map.pagesNotRead).toEqual([
      {
        name: "Community",
        error: FIGMA_OFFLINE,
      },
    ]);
    expect(map.more).toBe(false);
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

    const map = (await plugin.run("file_map", null)) as {
      pages: { nodes: unknown[]; total?: number }[];
      more: boolean;
    };

    expect(map.pages[0]?.nodes).toHaveLength(1_500);
    expect(map.pages[0]?.total).toBe(1_600);
    expect(map.more).toBe(true);
  });

  it("still lists the pages past the limit by id and name, so they can be outlined one by one", async () => {
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
      {
        pages: [
          tree({
            id: "0:2",
            type: "PAGE",
            name: "Archive",
            children: [{ id: "5:1" }],
          }),
        ],
      },
    );

    const map = (await plugin.run("file_map", null)) as { pages: unknown[]; more: boolean };

    expect(map.pages[1]).toEqual({
      id: "0:2",
      name: "Archive",
      current: false,
    });
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

    await plugin.run("screens", { node: "9:2" });

    expect(installed.writes.calls).toContainEqual(expect.objectContaining({ method: "loadAsync" }));
  });
});
