import { OPERATION_SCHEMAS } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/** What Figma answers on a plan without Dev Mode links (seen live on a Starter team). */
const REFUSED = 'unable to fetch related links Error: XHR for "/api/files/x/related_links" failed with status 403';

let page: FakeNode;
let figma: Record<string, unknown>;

function find(node: FakeNode, id: string): FakeNode | undefined {
  return node.id === id ? node : node.children?.map((child) => find(child, id)).find(Boolean);
}

/** The Badge set a nested instance comes from, with its definitions (a variant's would throw). */
const badgeSet = tree({
  id: "4:0",
  type: "COMPONENT_SET",
  name: "Badge",
  key: "set-badge",
  componentPropertyDefinitions: {
    Style: {
      type: "VARIANT",
      defaultValue: "Solid",
      variantOptions: ["Solid", "Outline"],
    },
    "Label#3:1": {
      type: "TEXT",
      defaultValue: "New",
    },
  },
  children: [
    {
      id: "4:1",
      type: "COMPONENT",
      name: "Style=Solid",
      key: "variant-solid",
    },
  ],
});

/** A nested Badge instance, exposed or not, with its values inside the component around it. */
const badge = (id: string, name: string, exposed: boolean) => ({
  id,
  name,
  type: "INSTANCE",
  isExposedInstance: exposed,
  componentProperties: {
    Style: {
      type: "VARIANT",
      value: "Outline",
    },
    "Label#3:1": {
      type: "TEXT",
      value: "Hot",
    },
  },
});

/** Figma's dev resources over the fake: a node's own links, its descendants' with includeChildren, an instance's inherited. */
function withLinks(links: Record<string, { name: string; url: string }[]>, refuse?: string): void {
  const own = (node: FakeNode) =>
    (links[node.id] ?? []).map((link) => ({
      ...link,
      nodeId: node.id,
    }));
  const inherited = (node: FakeNode) => {
    const main = node.mainComponent as { id?: string } | undefined;

    return node.type === "INSTANCE" && main?.id !== undefined
      ? (links[main.id] ?? []).map((link) => ({
          ...link,
          nodeId: node.id,
          inheritedNodeId: main.id,
        }))
      : [];
  };
  const attach = (node: FakeNode) => {
    node.getDevResourcesAsync = async (options?: { includeChildren?: boolean }) => {
      if (refuse !== undefined) {
        return options?.includeChildren ? [] : Promise.reject(new Error(refuse));
      }

      const below = options?.includeChildren ? (node.findAll?.(() => true) ?? []) : [];

      return [node, ...below].flatMap((each) => [...own(each), ...inherited(each)]);
    };

    for (const child of node.children ?? []) {
      attach(child);
    }
  };

  attach(page);
  attach(badgeSet);
  figma.root = {
    children: [page],
    getDevResourcesAsync: async () => (refuse === undefined ? [] : Promise.reject(new Error(refuse))),
  };
}

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    name: "Components",
    children: [
      {
        id: "7:0",
        type: "COMPONENT",
        name: "Card",
        key: "k-card",
        remote: false,
        description: "",
        componentPropertyDefinitions: {},
        children: [
          {
            id: "7:1",
            name: "Body",
            children: [
              badge("7:2", "Badge", true),
              badge("7:3", "Tag", false),
              {
                ...badge("7:4", "Inner", false),
                children: [badge("I7:4;1:1", "Deep", true)],
              },
            ],
          },
        ],
      },
      {
        id: "8:0",
        type: "COMPONENT_SET",
        name: "Plan",
        key: "k-plan",
        remote: false,
        description: "",
        componentPropertyDefinitions: {
          Tier: {
            type: "VARIANT",
            defaultValue: "A",
            variantOptions: ["A", "B"],
          },
        },
        children: [
          {
            id: "8:1",
            type: "COMPONENT",
            name: "Tier=A",
            key: "k-plan-a",
            remote: false,
            children: [badge("8:2", "Badge", true), badge("8:3", "Ribbon", true)],
          },
          {
            id: "8:4",
            type: "COMPONENT",
            name: "Tier=B",
            key: "k-plan-b",
            remote: false,
            children: [badge("8:5", "Badge", true)],
          },
        ],
      },
      {
        id: "3:1",
        name: "Screen",
        children: [
          {
            id: "3:2",
            type: "INSTANCE",
            name: "Logo",
          },
        ],
      },
    ],
  });

  for (const id of ["7:2", "7:3", "7:4", "I7:4;1:1", "8:2", "8:3", "8:5"]) {
    const node = find(page, id) as FakeNode;

    node.getMainComponentAsync = async () => find(badgeSet, "4:1") as never;
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
  const instance = find(page, "3:2") as FakeNode;

  instance.mainComponent = {
    id: "L:1",
    name: "Logo",
    parent: null,
  };
  instance.getMainComponentAsync = async () => logo as never;
  figma = installFigma(page).figma as unknown as Record<string, unknown>;
  figma.root = { children: [page] };
});

afterEach(() => {
  vi.useRealTimers();
});

const run = async (input: Record<string, unknown>) =>
  OPERATION_SCHEMAS.components.output.parse(await plugin.run("components", input));

describe("the nested instances a component exposes", () => {
  it("lists a component's exposed instances with their properties, defaults as set inside it, never inside another instance", async () => {
    const { components } = await run({
      scope: "local",
      query: "Card",
    });

    expect(components[0]?.exposed).toEqual([
      {
        id: "7:2",
        name: "Badge",
        component: "Badge",
        key: "set-badge",
        properties: {
          Style: {
            type: "VARIANT",
            default: "Outline",
            options: ["Solid", "Outline"],
          },
          Label: {
            type: "TEXT",
            default: "Hot",
          },
        },
      },
    ]);
  });

  it("combines a set's variants by layer name and component, naming the variants only when not all expose it", async () => {
    const { components } = await run({
      scope: "local",
      query: "Plan",
    });

    expect(
      components[0]?.exposed?.map(({ id, name, variants }) => ({
        id,
        name,
        variants,
      })),
    ).toEqual([
      {
        id: "8:2",
        name: "Badge",
        variants: undefined,
      },
      {
        id: "8:3",
        name: "Ribbon",
        variants: ["Tier=A"],
      },
    ]);
  });

  it("names the one variant that exposes two layers of one name and component, not every variant", async () => {
    const variant = find(page, "8:1") as FakeNode;
    const twin = tree({
      ...badge("8:9", "Ribbon", true),
    });

    twin.parent = variant;
    twin.getMainComponentAsync = async () => find(badgeSet, "4:1") as never;
    variant.children = [...(variant.children ?? []), twin];

    const { components } = await run({
      scope: "local",
      query: "Plan",
    });

    expect(components[0]?.exposed?.find(({ name }) => name === "Ribbon")?.variants).toEqual(["Tier=A"]);
  });

  it("leaves exposed out where nothing is exposed, and links out where they were not asked for", async () => {
    const answer = await run({
      scope: "used",
      within: "3:1",
    });

    expect(answer.components[0]).not.toHaveProperty("exposed");
    expect(answer.components[0]).not.toHaveProperty("links");
    expect(answer).not.toHaveProperty("linksRead");
  });
});

describe("Dev Mode links, on request", () => {
  it("reads a component's own links, a set's and its variants', and a library component's through its instance", async () => {
    withLinks({
      "7:0": [
        {
          name: "Card.tsx",
          url: "https://github.com/acme/site/blob/main/src/Card.tsx",
        },
      ],
      "8:0": [
        {
          name: "Docs",
          url: "https://docs.acme.dev/plan",
        },
      ],
      "8:4": [
        {
          name: "Story",
          url: "https://storybook.acme.dev/plan-b",
        },
      ],
      "L:1": [
        {
          name: "Logo",
          url: "https://github.com/acme/ui/blob/main/Logo.tsx",
        },
      ],
      "4:1": [
        {
          name: "Badge",
          url: "https://github.com/acme/ui/blob/main/Badge.tsx",
        },
      ],
    });

    const local = await run({
      scope: "local",
      links: true,
    });
    const used = await run({
      scope: "used",
      within: "3:1",
      links: true,
    });

    expect(local.linksRead).toBe(true);
    expect(local.components.map(({ name, links }) => [name, links])).toEqual([
      [
        "Card",
        [
          {
            name: "Card.tsx",
            url: "https://github.com/acme/site/blob/main/src/Card.tsx",
          },
        ],
      ],
      [
        "Plan",
        [
          {
            name: "Docs",
            url: "https://docs.acme.dev/plan",
          },
          {
            name: "Story",
            url: "https://storybook.acme.dev/plan-b",
            on: "Tier=B",
          },
        ],
      ],
    ]);
    expect(used.components[0]?.links).toEqual([
      {
        name: "Logo",
        url: "https://github.com/acme/ui/blob/main/Logo.tsx",
      },
    ]);
  });

  it("says Figma refused them, in its words, and never takes includeChildren's empty answer for no links", async () => {
    withLinks(
      {
        "7:0": [
          {
            name: "Card.tsx",
            url: "https://example.com",
          },
        ],
      },
      REFUSED,
    );

    const answer = await run({
      scope: "local",
      links: true,
    });

    expect(answer.linksRead).toBe(true);
    expect(answer.linksNote).toBe(
      `Dev Mode links are not available in this file: Figma refused them (${REFUSED}); they come with a paid plan and a Full or Dev seat.`,
    );
    expect(answer.components.some((entry) => "links" in entry)).toBe(false);
  });

  it("gives up after 5 s without an answer, with a note, and the components still come", async () => {
    withLinks({});
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    (figma.root as Record<string, unknown>).getDevResourcesAsync = () => new Promise(() => {});

    const pending = run({
      scope: "local",
      links: true,
    });

    await vi.advanceTimersByTimeAsync(5_000);

    const answer = await pending;

    expect(answer.components).toHaveLength(2);
    expect(answer.linksNote).toMatch(/no answer about Dev Mode links within 5 s/);
  });

  it("reads none where Figma has no API for them, and says nothing", async () => {
    const answer = await run({
      scope: "local",
      links: true,
    });

    expect(answer.linksRead).toBe(true);
    expect(answer).not.toHaveProperty("linksNote");
    expect(answer.components.some((entry) => "links" in entry)).toBe(false);
  });
});

describe("a page Figma cannot load", () => {
  it("is left out with Figma's words, and the other pages' components are still listed", async () => {
    const other = tree({
      id: "0:2",
      type: "PAGE",
      name: "Community",
      children: [],
    });

    other.loadAsync = async () => {
      throw new Error(
        "Unable to establish connection to Figma after 10 seconds. Please check your internet connection.",
      );
    };
    figma.root = { children: [page, other] };

    const answer = await run({ scope: "local" });

    expect(answer.components.map(({ name }) => name)).toEqual(["Card", "Plan"]);
    expect(answer.pagesNotRead).toEqual([
      {
        name: "Community",
        error: "Unable to establish connection to Figma after 10 seconds. Please check your internet connection.",
      },
    ]);
  });
});
