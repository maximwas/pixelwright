import { beforeEach, describe, expect, it } from "vitest";
import { runOperation } from "../src/figma/operations.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";

let page: FakeNode;
let installed: ReturnType<typeof installFigma>;

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    name: "Page 1",
    children: [
      {
        id: "2:4868",
        name: "Services block",
        absoluteBoundingBox: {
          x: 0,
          y: 1102,
          width: 1440,
          height: 1010,
        },
        children: [
          {
            id: "2:4873",
            name: "Link",
            type: "INSTANCE",
            mainComponent: {
              name: "Property 1=Black",
              parent: {
                type: "COMPONENT_SET",
                name: "Link",
              },
            },
            children: [
              {
                id: "I2:4873;334:1481",
                name: "Label",
                type: "TEXT",
                characters: "Learn more",
              },
            ],
          },
          {
            id: "2:4875",
            name: "tokyo-magnifier",
            type: "RECTANGLE",
          },
        ],
      },
      {
        id: "2:4907",
        name: "CTA block",
        type: "GROUP",
      },
    ],
  });
  installed = installFigma(page);
});

describe("read operations", () => {
  it("lists the selection with boxes", async () => {
    installed.figma.currentPage.selection = [page.children?.[0] as FakeNode];

    await expect(runOperation("selection", null)).resolves.toEqual({
      nodes: [
        {
          id: "2:4868",
          name: "Services block",
          type: "FRAME",
          box: {
            x: 0,
            y: 1102,
            width: 1440,
            height: 1010,
          },
        },
      ],
    });
  });

  it("finds nodes by name, type, text and component, with their ancestors", async () => {
    const byText = (await runOperation("find", { text: "learn" })) as { nodes: { id: string; path: string[] }[] };

    expect(byText.nodes.map((node) => node.id)).toEqual(["I2:4873;334:1481"]);
    expect(byText.nodes[0]?.path).toEqual(["Services block", "Link"]);
    await expect(runOperation("find", { type: "GROUP" })).resolves.toMatchObject({ nodes: [{ id: "2:4907" }] });
    await expect(runOperation("find", { name: "TOKYO" })).resolves.toMatchObject({ nodes: [{ id: "2:4875" }] });
    await expect(runOperation("find", { component: "link" })).resolves.toMatchObject({ nodes: [{ id: "2:4873" }] });
  });

  it("searches only inside within, and says when the limit cut the list", async () => {
    await expect(
      runOperation("find", {
        within: "2:4868",
        type: "GROUP",
      }),
    ).resolves.toEqual({
      nodes: [],
      more: false,
    });
    await expect(runOperation("find", { limit: 1 })).resolves.toMatchObject({ more: true });
  });

  it("selects and zooms to a node, and fails on an id that does not exist", async () => {
    await expect(runOperation("show", { node: "2:4875" })).resolves.toEqual({
      nodes: [
        {
          id: "2:4875",
          name: "tokyo-magnifier",
        },
      ],
      page: "Page 1",
      zoom: 1,
    });
    expect(installed.state.zoomedTo.map((node) => node.id)).toEqual(["2:4875"]);
    await expect(runOperation("show", { node: "9:9" })).rejects.toMatchObject({ code: "NODE_NOT_FOUND" });
  });
});

describe("outline", () => {
  it("returns the tree to a depth, with boxes relative to the root and child counts where it stops", async () => {
    const outline = (await runOperation("outline", {
      node: "2:4868",
      depth: 1,
    })) as {
      root: { x: number; y: number; children: { id: string; childCount: number; children?: unknown }[] };
    };

    expect(outline.root).toMatchObject({
      x: 0,
      y: 0,
    });
    expect(outline.root.children.map((child) => [child.id, child.childCount, child.children])).toEqual([
      ["2:4873", 1, undefined],
      ["2:4875", 0, undefined],
    ]);
  });
});

describe("outline of a frame with more children than one outline lists", () => {
  it("lists the first ones and keeps the full count", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "1:1",
            children: Array.from({ length: 2_500 }, (_, index) => ({ id: `1:${index + 2}` })),
          },
        ],
      }),
    );

    const outline = (await runOperation("outline", { node: "1:1" })) as {
      root: { childCount: number; children: unknown[] };
    };

    expect(outline.root.childCount).toBe(2_500);
    expect(outline.root.children).toHaveLength(1_999);
  });
});

describe("outline of the document", () => {
  it("lists the pages, without child counts a page not loaded yet cannot give", async () => {
    installFigma(
      tree({
        id: "0:0",
        type: "DOCUMENT",
        name: "Untitled",
        children: [
          {
            id: "0:1",
            type: "PAGE",
            name: "Landing",
            children: [{ id: "2:4766" }],
          },
          {
            id: "0:2",
            type: "PAGE",
            name: "Components",
          },
        ],
      }),
    );

    const outline = (await runOperation("outline", { node: "0:0" })) as { root: unknown };

    expect(outline.root).toEqual({
      id: "0:0",
      name: "Untitled",
      type: "DOCUMENT",
      childCount: 2,
      children: [
        {
          id: "0:1",
          name: "Landing",
          type: "PAGE",
        },
        {
          id: "0:2",
          name: "Components",
          type: "PAGE",
        },
      ],
    });
  });
});

describe("find on a page the user has not opened", () => {
  it("loads the page before searching it", async () => {
    const other = tree({
      id: "0:2",
      type: "PAGE",
      name: "Components",
    });
    let loaded = false;

    other.loadAsync = async () => {
      loaded = true;
      other.children = [
        tree(
          {
            id: "7:1",
            name: "Button",
          },
          other,
        ),
      ];
    };
    installFigma(
      tree({
        id: "0:0",
        type: "DOCUMENT",
        children: [],
      }),
    );
    Object.assign(figma, {
      currentPage: tree({
        id: "0:1",
        type: "PAGE",
      }),
      getNodeByIdAsync: async (id: string) => (id === "0:2" ? other : null),
    });

    const found = (await runOperation("find", {
      name: "Button",
      within: "0:2",
    })) as { nodes: { id: string }[] };

    expect(loaded).toBe(true);
    expect(found.nodes.map((node) => node.id)).toEqual(["7:1"]);
  });
});

describe("outline of repeated components", () => {
  it("names each instance's component and variant, so repeated cards show without a read", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "4:1",
            type: "INSTANCE",
            name: "Card",
            mainComponent: {
              name: "Type=Hover, Size=L",
              parent: {
                type: "COMPONENT_SET",
                name: "Card",
              },
            },
          },
          {
            id: "4:2",
            type: "INSTANCE",
            name: "Logo",
            mainComponent: {
              name: "Logo",
              parent: null,
            },
          },
        ],
      }),
    );

    const outline = (await runOperation("outline", { depth: 1 })) as {
      root: { children: { id: string; component?: string; variant?: string }[] };
    };

    expect(outline.root.children.map(({ id, component, variant }) => [id, component, variant])).toEqual([
      ["4:1", "Card", "Type=Hover, Size=L"],
      ["4:2", "Logo", undefined],
    ]);
  });
});

describe("the view", () => {
  const board = () =>
    tree({
      id: "0:1",
      type: "PAGE",
      name: "Page 1",
      children: [
        {
          id: "8:1",
          type: "FRAME",
          name: "Home",
          absoluteBoundingBox: {
            x: 0,
            y: 0,
            width: 1440,
            height: 3000,
          },
          children: [
            {
              id: "8:2",
              type: "FRAME",
              name: "Hero",
              absoluteBoundingBox: {
                x: 0,
                y: 0,
                width: 1440,
                height: 800,
              },
            },
            {
              id: "8:3",
              type: "FRAME",
              name: "Footer",
              absoluteBoundingBox: {
                x: 0,
                y: 2600,
                width: 1440,
                height: 400,
              },
            },
          ],
        },
        {
          id: "8:4",
          type: "FRAME",
          name: "Mobile",
          absoluteBoundingBox: {
            x: 2000,
            y: 0,
            width: 375,
            height: 800,
          },
        },
      ],
    });

  it("shows several layers at a zoom without touching the selection", async () => {
    const installed = installFigma(board());

    installed.figma.currentPage.selection = [];

    await expect(
      runOperation("show", {
        nodes: ["8:2", "8:3"],
        zoom: 0.5,
        select: false,
      }),
    ).resolves.toEqual({
      nodes: [
        {
          id: "8:2",
          name: "Hero",
        },
        {
          id: "8:3",
          name: "Footer",
        },
      ],
      page: "Page 1",
      zoom: 0.5,
    });
    expect(installed.state.zoomedTo.map((node) => node.id)).toEqual(["8:2", "8:3"]);
    expect(installed.figma.currentPage.selection).toEqual([]);
  });

  it("says what the user sees: the page, the zoom and the layers in view", async () => {
    const installed = installFigma(board());

    Object.assign(installed.figma.viewport, {
      zoom: 0.25,
      bounds: {
        x: -100,
        y: -100,
        width: 1600,
        height: 1000,
      },
    });

    const view = (await runOperation("viewport", null)) as {
      page: string;
      zoom: number;
      layers: { id: string }[];
    };

    expect(view).toMatchObject({
      page: "Page 1",
      zoom: 0.25,
    });
    expect(view.layers.map((layer) => layer.id)).toEqual(["8:1", "8:2"]);
  });
});

describe("a component's set", () => {
  it("is found from the set, a variant of it, or an instance of a variant", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "5:1",
            type: "COMPONENT_SET",
            name: "Button",
            children: [
              {
                id: "5:2",
                type: "COMPONENT",
                name: "State=Default",
              },
            ],
          },
          {
            id: "5:9",
            type: "INSTANCE",
            name: "Buy",
            mainComponent: {
              id: "5:2",
              name: "State=Default",
              parent: {
                type: "COMPONENT_SET",
                id: "5:1",
                name: "Button",
              },
            },
          },
          {
            id: "5:8",
            type: "FRAME",
            name: "Card",
          },
        ],
      }),
    );

    for (const node of ["5:1", "5:2", "5:9"]) {
      await expect(runOperation("set_of", { node })).resolves.toEqual({
        id: "5:1",
        name: "Button",
      });
    }

    await expect(runOperation("set_of", { node: "5:8" })).rejects.toThrow(/not a component set/);
  });
});
