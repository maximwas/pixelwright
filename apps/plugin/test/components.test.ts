import { beforeEach, describe, expect, it } from "vitest";
import { runOperation } from "../src/figma/operations.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";

/** A variant's own definitions: Figma throws when they are read, so reading them is a bug. */
const variantDefinitions = () => {
  throw new Error("componentPropertyDefinitions read on a variant");
};

let page: FakeNode;

function find(node: FakeNode, id: string): FakeNode | undefined {
  return node.id === id ? node : node.children?.map((child) => find(child, id)).find(Boolean);
}

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    name: "Components",
    children: [
      {
        id: "9:0",
        type: "COMPONENT_SET",
        name: "Button",
        key: "k-button",
        description: "Primary action",
        remote: false,
        componentPropertyDefinitions: {
          Size: {
            type: "VARIANT",
            defaultValue: "Large",
            variantOptions: ["Large", "Small"],
          },
          "Label#1:0": {
            type: "TEXT",
            defaultValue: "Sign up",
          },
          "Icon#1:1": {
            type: "BOOLEAN",
            defaultValue: true,
          },
        },
        children: [
          {
            id: "9:1",
            type: "COMPONENT",
            name: "Size=Large",
            key: "k-large",
            remote: false,
          },
          {
            id: "9:2",
            type: "COMPONENT",
            name: "Size=Small",
            key: "k-small",
            remote: false,
          },
        ],
      },
      {
        id: "9:5",
        type: "COMPONENT",
        name: "Badge",
        key: "k-badge",
        remote: false,
        description: "",
        componentPropertyDefinitions: {},
      },
      {
        id: "3:1",
        name: "Screen",
        children: [
          {
            id: "3:2",
            type: "INSTANCE",
            name: "Button",
          },
          {
            id: "3:3",
            type: "INSTANCE",
            name: "Button",
          },
          {
            id: "3:4",
            type: "INSTANCE",
            name: "Logo",
          },
        ],
      },
    ],
  });

  for (const id of ["9:1", "9:2"]) {
    Object.defineProperty(find(page, id), "componentPropertyDefinitions", { get: variantDefinitions });
  }

  const logo = tree({
    id: "L:1",
    type: "COMPONENT",
    name: "Logo",
    key: "k-logo",
    remote: true,
    description: "",
    componentPropertyDefinitions: {},
  });
  const mains: Record<string, FakeNode | undefined> = {
    "3:2": find(page, "9:1"),
    "3:3": find(page, "9:2"),
    "3:4": logo,
  };

  for (const [id, main] of Object.entries(mains)) {
    const instance = find(page, id) as FakeNode;

    instance.getMainComponentAsync = async () => main as never;
  }

  const { figma } = installFigma(page);

  Object.assign(figma, { root: { children: [page] } });
});

describe("components", () => {
  it("lists the file's components, variants folded into their set, properties read from the set", async () => {
    const { components, more } = (await runOperation("components", { scope: "local" })) as {
      components: unknown[];
      more: boolean;
    };

    expect(more).toBe(false);
    expect(components).toEqual([
      {
        id: "9:0",
        key: "k-button",
        type: "COMPONENT_SET",
        name: "Button",
        page: "Components",
        remote: false,
        description: "Primary action",
        variants: [
          {
            id: "9:1",
            name: "Size=Large",
          },
          {
            id: "9:2",
            name: "Size=Small",
          },
        ],
        properties: {
          Size: {
            type: "VARIANT",
            default: "Large",
            options: ["Large", "Small"],
          },
          Label: {
            type: "TEXT",
            default: "Sign up",
          },
          Icon: {
            type: "BOOLEAN",
            default: true,
          },
        },
      },
      {
        id: "9:5",
        key: "k-badge",
        type: "COMPONENT",
        name: "Badge",
        page: "Components",
        remote: false,
        properties: {},
      },
    ]);
  });

  it("lists the components a page uses, a library's among them, with how many instances each has", async () => {
    const { components } = (await runOperation("components", {
      scope: "used",
      within: "3:1",
    })) as {
      components: { name: string; remote: boolean; instances?: number }[];
    };

    expect(components.map(({ name, remote, instances }) => [name, remote, instances])).toEqual([
      ["Button", false, 2],
      ["Logo", true, 1],
    ]);
  });

  it("narrows by name and stops at the limit, saying there is more", async () => {
    const byName = (await runOperation("components", {
      scope: "local",
      query: "but",
    })) as {
      components: { name: string }[];
    };
    const limited = (await runOperation("components", {
      scope: "local",
      limit: 1,
    })) as {
      components: unknown[];
      more: boolean;
    };

    expect(byName.components.map(({ name }) => name)).toEqual(["Button"]);
    expect(limited).toMatchObject({ more: true });
    expect(limited.components).toHaveLength(1);
  });
});
