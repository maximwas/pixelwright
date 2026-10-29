import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { type ReadModel, ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";
import { fixture, reader } from "./support/design-classes.ts";

/** A layer of the landing page: a frame unless told otherwise. */
function layer(fields: {
  id: string;
  name: string;
  type?: string;
  layoutMode?: string;
  text?: object;
  children?: object[];
}) {
  return {
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    childCount: fields.children?.length ?? 0,
    ...fields,
  };
}

/** A landing page: 10 sections of 10 cards of 10 rows of 5 texts, about 5,600 layers. */
function landing(): ReadModel {
  let next = 0;
  const id = () => `9:${next++}`;
  const text = () =>
    layer({
      id: id(),
      type: "TEXT",
      name: "Copy",
      text: {
        characters: "Lorem ipsum dolor sit amet",
        textAutoResize: "WIDTH_AND_HEIGHT",
        textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP",
        segments: [],
      },
    });
  const row = () =>
    layer({ id: id(), name: "Row", layoutMode: "HORIZONTAL", children: Array.from({ length: 5 }, text) });
  const card = () =>
    layer({ id: id(), name: "Card", layoutMode: "VERTICAL", children: Array.from({ length: 10 }, row) });
  const section = () =>
    layer({ id: id(), name: "Section", layoutMode: "HORIZONTAL", children: Array.from({ length: 10 }, card) });

  return zod.parse(ReadModelSchema, {
    root: layer({ id: id(), name: "Landing", layoutMode: "VERTICAL", children: Array.from({ length: 10 }, section) }),
    styles: {},
    variables: {},
  });
}

describe("fitting a huge read into maxChars (T-054)", () => {
  it("cuts the deepest branches first, keeps every section, and names what it cut", () => {
    const read = reader.read(landing(), { maxChars: 80_000 });

    expect(read.xml.length).toBeLessThanOrEqual(80_000);
    expect(read.xml.match(/name="Section"/g)).toHaveLength(10);
    expect(read.xml.match(/name="Card"/g)).toHaveLength(100);
    expect(read.truncated.length).toBeGreaterThan(0);

    for (const truncated of read.truncated.slice(0, 20)) {
      expect(read.xml).toMatch(new RegExp(`id="${truncated}"[^>]*\\$truncated="true"/>`));
    }
  });

  it("leaves a read that fits untouched", () => {
    const read = reader.read(fixture("orbit-plans"), { maxChars: 80_000 });

    expect(read.truncated).toEqual([]);
    expect(read.xml).not.toContain("$truncated");
  });

  it("lists the children a tight read keeps and shortens the longest texts last", () => {
    // 300 is past what cuts can reach: the frame keeps its first child and its texts shrink to their ellipsis.
    const read = reader.read(fixture("orbit-customers"), { maxChars: 300 });

    expect(read.xml).toContain('$children="');
    expect(read.xml).toContain("\u2026</Text>");
  });
});
