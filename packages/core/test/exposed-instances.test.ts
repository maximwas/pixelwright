import { describe, expect, it } from "vitest";
import { designXml, OPERATION_SCHEMAS, readApply, type Snapshot, type SnapshotNode } from "../src/index.ts";

const instance = (id: string, name: string, exposed: boolean): SnapshotNode => ({
  id,
  name,
  type: "INSTANCE",
  visible: true,
  x: 0,
  y: 0,
  width: 80,
  height: 24,
  childCount: 0,
  instance: {
    componentId: `${id}0`,
    componentName: "Style=Solid",
    componentKey: "variant-key",
    setId: "4:0",
    setName: "Badge",
    setKey: "set-key",
    ...(exposed ? { exposed: true as const } : {}),
    properties: {
      Style: {
        type: "VARIANT",
        value: "Solid",
      },
      "Label#3:1": {
        type: "TEXT",
        value: "New",
      },
    },
  },
});

const card = (): Snapshot => ({
  root: {
    id: "9:1",
    name: "Card",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 300,
    height: 100,
    childCount: 2,
    children: [instance("9:2", "Badge", true), instance("9:3", "Tag", false)],
  },
  styles: {},
  variables: {},
});

describe("an instance its component exposes", () => {
  it("is marked $exposed right after its props; another instance is not", () => {
    const xml = designXml(card()).xml;

    expect(xml).toContain(
      '<Instance id="9:2" name="Badge" component="Badge" variant="Style=Solid" props="Label=New" $exposed="true" ',
    );
    expect(xml).toMatch(/id="9:3"(?![^>]*\$exposed)/);
  });

  it("sends nothing back to design_apply: $exposed is read-only", () => {
    const { elements, errors } = readApply(designXml(card()).xml);

    expect(errors).toEqual([]);
    expect(elements.find(({ id }) => id === "9:2")?.attributes).not.toHaveProperty("$exposed");
  });

  it("keeps the set's key and the mark in the snapshot schema", () => {
    const parsed = OPERATION_SCHEMAS.snapshot.output.parse(card());

    expect(parsed.root.children?.[0]?.instance).toMatchObject({
      setKey: "set-key",
      exposed: true,
    });
  });
});
