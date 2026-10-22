import { beforeEach, describe, expect, it } from "vitest";
import { findNodes } from "../../server/src/features/nodes-find/find-nodes.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginClient } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/** An instance of the Menu item set's variant with these values, as Figma names a variant. */
const item = (id: string, variant: string) => ({
  id,
  type: "INSTANCE",
  name: "Item",
  mainComponent: {
    name: variant,
    parent: {
      type: "COMPONENT_SET",
      name: "Menu item",
    },
  },
});

/** A round menu: four items in three variants, a logo of a component without variants, and a plain frame. */
const menu = (): FakeNode =>
  tree({
    id: "0:1",
    type: "PAGE",
    name: "Menu",
    children: [
      {
        id: "3:1",
        name: "Round menu",
        children: [
          item("3:2", "State=Default, Size=L"),
          item("3:3", "State=Hover, Size=L"),
          item("3:4", "State=Hover, Size=S"),
          item("3:5", "State=Hover, Size=L"),
          {
            id: "3:6",
            type: "INSTANCE",
            name: "Logo",
            mainComponent: {
              name: "Logo",
              parent: null,
            },
          },
          {
            id: "3:7",
            name: "Hover note",
          },
        ],
      },
    ],
  });

type Found = {
  nodes: { id: string }[];
  more: boolean;
  counts?: { component: string; variant?: string; count: number }[];
};

describe("nodes_find by variant", () => {
  beforeEach(() => {
    installFigma(menu());
  });

  it("finds the instances whose main component has every variant value given, in any order and case", async () => {
    const found = (await plugin.run("find", { variant: "size=l, State=Hover" })) as Found;

    expect(found.nodes.map(({ id }) => id)).toEqual(["3:3", "3:5"]);
    expect(found.more).toBe(false);
  });

  it("narrows a component query to one variant", async () => {
    const found = (await plugin.run("find", {
      component: "menu item",
      variant: "Size=S",
    })) as Found;

    expect(found.nodes.map(({ id }) => id)).toEqual(["3:4"]);
  });

  it("refuses a variant that is not a list of Name=Value", async () => {
    await expect(plugin.run("find", { variant: "Hover" })).rejects.toMatchObject({
      code: "OP_FAILED",
      message: expect.stringMatching(/Name=Value/),
    });
  });
});

describe("nodes_find counts", () => {
  beforeEach(() => {
    installFigma(menu());
  });

  it("counts every instance found by component and variant, past the limit of those listed", async () => {
    const found = (await plugin.run("find", {
      component: "menu item",
      counts: true,
      limit: 1,
    })) as Found;

    expect(found.nodes.map(({ id }) => id)).toEqual(["3:2"]);
    expect(found.more).toBe(true);
    expect(found.counts).toEqual([
      {
        component: "Menu item",
        variant: "State=Default, Size=L",
        count: 1,
      },
      {
        component: "Menu item",
        variant: "State=Hover, Size=L",
        count: 2,
      },
      {
        component: "Menu item",
        variant: "State=Hover, Size=S",
        count: 1,
      },
    ]);
  });

  it("counts a component without variants by its name, and only the instances among what was found", async () => {
    const found = (await plugin.run("find", {
      name: "o",
      counts: true,
    })) as Found;

    expect(found.nodes.map(({ id }) => id)).toEqual(["3:1", "3:6", "3:7"]);
    expect(found.counts).toEqual([
      {
        component: "Logo",
        count: 1,
      },
    ]);
  });

  it("gives no counts unless asked", async () => {
    const found = (await plugin.run("find", { component: "menu item" })) as Found;

    expect(found).not.toHaveProperty("counts");
  });
});

describe("nodes_find counts in the whole file", () => {
  beforeEach(() => {
    const other = tree({
      id: "0:2",
      type: "PAGE",
      name: "Settings",
      children: [item("8:1", "State=Hover, Size=L"), item("8:2", "State=Pressed, Size=L")],
    });

    installFigma(menu(), { pages: [other] });
  });

  it("adds up every page's counts, past the limit of those listed", async () => {
    const found = await findNodes(pluginClient(plugin), {
      variant: "Size=L",
      within: "file",
      counts: true,
      limit: 1,
    });

    expect(found.nodes.map(({ id }) => id)).toEqual(["3:2"]);
    expect(found.more).toBe(true);
    expect(found.counts).toEqual([
      {
        component: "Menu item",
        variant: "State=Default, Size=L",
        count: 1,
      },
      {
        component: "Menu item",
        variant: "State=Hover, Size=L",
        count: 3,
      },
      {
        component: "Menu item",
        variant: "State=Pressed, Size=L",
        count: 1,
      },
    ]);
  });
});
