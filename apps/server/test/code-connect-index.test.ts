import type { SnapshotNode } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { ConnectionIndex } from "../src/code-connect/connection-index.ts";
import type { TemplateFile } from "../src/types/code-connect.ts";

type Instance = NonNullable<SnapshotNode["instance"]>;

function instance(fields: Partial<Instance>): Instance {
  return {
    componentId: "1:2",
    componentName: "Button",
    componentKey: "variant-key",
    properties: {},
    ...fields,
  };
}

function connection(path: string, fields: Partial<TemplateFile> = {}): TemplateFile {
  return {
    path,
    source: "",
    ...fields,
  };
}

const linked = (nodeId: string, fileKey = "KIT") => ({
  url: `https://www.figma.com/design/${fileKey}/Kit?node-id=${nodeId.replace(":", "-")}`,
  nodeId,
  fileKey,
});

describe("ConnectionIndex", () => {
  it("matches a keyed connection by the set's or the component's key, and never by its link or name", () => {
    const index = new ConnectionIndex([
      connection("Button.figma.ts", {
        key: "set-key",
        component: "Button",
        ...linked("1:2"),
      }),
      connection("Icon.figma.ts", { key: "icon-key" }),
    ]);

    expect(
      index.match(
        instance({
          setId: "1:1",
          setName: "Button",
          setKey: "set-key",
        }),
      ),
    ).toMatchObject({
      template: { path: "Button.figma.ts" },
      by: "key",
    });
    expect(
      index.match(
        instance({
          componentKey: "icon-key",
          componentName: "Check",
        }),
      )?.by,
    ).toBe("key");
    // Same id and name as the keyed one, another key: no match.
    expect(index.match(instance({ setKey: "other" }))).toBeNull();
  });

  it("says how a keyless one matched: id with name, name alone (a library's), id alone (renamed)", () => {
    const index = new ConnectionIndex([
      connection("Button.figma.ts", linked("1:2")),
      connection("Card.figma.ts", linked("5:5")),
    ]);

    expect(index.match(instance({}))?.by).toBe("id");
    expect(
      index.match(
        instance({
          componentId: "8:8",
          remote: true,
        }),
      ),
    ).toMatchObject({
      template: { path: "Button.figma.ts" },
      by: "name",
    });
    expect(
      index.match(
        instance({
          componentId: "5:5",
          componentName: "Tile",
        }),
      ),
    ).toMatchObject({
      template: { path: "Card.figma.ts" },
      by: "id",
    });
  });

  it("counts a url's node id only from the open file's urls once its key is known", () => {
    const connections = [connection("Tile.figma.ts", linked("1:2", "OTHER"))];

    expect(new ConnectionIndex(connections).match(instance({ componentName: "Card" }))?.by).toBe("id");
    expect(new ConnectionIndex(connections, { fileKey: "KIT" }).match(instance({ componentName: "Card" }))).toBeNull();
    expect(new ConnectionIndex(connections, { fileKey: "KIT" }).match(instance({ componentName: "Tile" }))?.by).toBe(
      "name",
    );
  });

  it("matches a component set listed by components_read through a url naming one of its variants, or its key", () => {
    const index = new ConnectionIndex([
      connection("Plan.figma.ts", linked("9:2")),
      connection("rows.figma.batch.json#1", { key: "k-badge" }),
    ]);
    const owner = (fields: Record<string, unknown>) => ({
      id: "9:0",
      key: "k-plan",
      type: "COMPONENT_SET" as const,
      name: "Plan Card",
      page: "Components",
      remote: false,
      properties: {},
      variants: [
        {
          id: "9:1",
          name: "Tier=A",
        },
        {
          id: "9:2",
          name: "Tier=B",
        },
      ],
      ...fields,
    });

    expect(index.forOwner(owner({}))).toMatchObject({
      template: { path: "Plan.figma.ts" },
      by: "id",
    });
    expect(
      index.forOwner(
        owner({
          id: "4:0",
          key: "k-badge",
          name: "Badge",
          variants: [],
        }),
      )?.by,
    ).toBe("key");
    expect(
      index.forOwner(
        owner({
          id: "7:0",
          key: "k-tag",
          name: "Tag",
          variants: [],
        }),
      ),
    ).toBeNull();
  });
});
