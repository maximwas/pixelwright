import { type ApplyChange, type ApplyError, changeOf, readApply } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

function changesOf(xml: string): ApplyChange[] {
  const { elements, errors } = readApply(xml);

  expect(errors).toEqual([]);

  return elements.map((element) => changeOf(element).change);
}

const apply = async (xml: string) =>
  (await plugin.run("apply", { changes: changesOf(xml) })) as { changed: string[]; errors: ApplyError[] };

let page: FakeNode;

const byId = (id: string) => page.children?.[0]?.children?.find((node) => node.id === id) as FakeNode;

beforeEach(() => {
  // Three columns, one row: a card across the first two, another in the third.
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Grid",
        layoutMode: "GRID",
        gridColumnCount: 3,
        gridRowCount: 1,
        children: [
          {
            id: "1:2",
            type: "RECTANGLE",
            name: "Wide",
            gridRowAnchorIndex: 0,
            gridColumnAnchorIndex: 0,
            gridRowSpan: 1,
            gridColumnSpan: 2,
          },
          {
            id: "1:3",
            type: "RECTANGLE",
            name: "Side",
            gridRowAnchorIndex: 0,
            gridColumnAnchorIndex: 2,
            gridRowSpan: 1,
            gridColumnSpan: 1,
          },
        ],
      },
    ],
  });
  installFigma(page);
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("apply: a grid's child moved to another cell", () => {
  it("narrows its span before it moves, so it never covers a taken cell on the way", async () => {
    const { errors } = await apply('<Rectangle id="1:2" grid-column="2"/>');

    expect(errors).toEqual([]);
    expect(byId("1:2")).toMatchObject({
      gridColumnAnchorIndex: 1,
      gridColumnSpan: 1,
    });
  });

  it("says how a child fills its cell when it is given flex, which fills a flex parent only", async () => {
    const { errors } = await apply('<Rectangle id="1:3" flex="1"/>');

    expect(
      errors.map(({ message, hint }) => ({
        message,
        hint,
      })),
    ).toEqual([
      {
        message: "flex fills a flex parent's direction: this layer's parent is a grid.",
        hint: 'Fill its cell with justify-self="stretch" and align-self="stretch".',
      },
    ]);
  });

  it("says to reopen the plugin window when Figma's sandbox has spent its callback ids on grid tracks", async () => {
    // Figma's words, seen after thousands of calls through one plugin window (Dukach feedback, bug 4).
    Object.defineProperty(page.children?.[0], "gridColumnSizes", {
      get: () => {
        throw new Error("Attempted to invoke callback with invalid id -32605");
      },
      set: () => {},
    });

    const { errors } = await apply('<Frame id="1:1" display="grid" grid-template-columns="100px 1fr 1fr"/>');

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/invalid id -32605.*close and reopen the Pixelwright plugin window/s);
  });
});
