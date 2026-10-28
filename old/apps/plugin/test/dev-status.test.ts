import { describe, expect, it } from "vitest";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const page = () =>
  tree({
    id: "0:1",
    type: "PAGE",
    name: "App",
    children: [
      {
        id: "3:1",
        type: "SECTION",
        name: "Checkout",
        devStatus: { type: "READY_FOR_DEV" },
        children: [
          {
            id: "3:2",
            type: "FRAME",
            name: "Pay",
            children: [
              {
                id: "3:3",
                name: "Total",
              },
            ],
          },
        ],
      },
      {
        id: "4:1",
        type: "FRAME",
        name: "Home",
        devStatus: { type: "COMPLETED" },
      },
      {
        id: "5:1",
        type: "FRAME",
        name: "Draft",
        devStatus: null,
      },
    ],
  });

describe("what the designer marked ready for dev", () => {
  it("shows in the outline and the file map", async () => {
    const { figma } = installFigma(page());

    Object.assign(figma, { root: { children: [figma.currentPage] } });

    const { root } = (await plugin.run("outline", { depth: 1 })) as {
      root: { children: { id: string; dev?: string }[] };
    };
    const map = (await plugin.run("file_map", null)) as {
      pages: { nodes: { id: string; devStatus?: string }[] }[];
    };

    expect(root.children.map(({ id, dev }) => [id, dev])).toEqual([
      ["3:1", "ready"],
      ["4:1", "completed"],
      ["5:1", undefined],
    ]);
    expect(map.pages[0]?.nodes.map(({ id, devStatus }) => [id, devStatus])).toEqual([
      ["3:1", "ready"],
      ["4:1", "completed"],
      ["5:1", undefined],
    ]);
  });

  it("gives a read the status of the layer or the nearest one above it that has one", async () => {
    installFigma(page());

    expect(await plugin.run("snapshot", { node: "3:3" })).toMatchObject({ devStatus: "ready" });
    expect(await plugin.run("snapshot", { node: "5:1" })).not.toHaveProperty("devStatus");
  });
});
