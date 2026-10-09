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
      id: "2:4875",
      name: "tokyo-magnifier",
      page: "Page 1",
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
