import { type ApplyChange, type ApplyError, changeOf, readApply } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

interface Applied {
  changed: string[];
  errors: ApplyError[];
}

function changesOf(xml: string): ApplyChange[] {
  const { elements, errors } = readApply(xml);

  expect(errors).toEqual([]);

  return elements.map((element) => changeOf(element).change);
}

const apply = async (xml: string) => (await plugin.run("apply", { changes: changesOf(xml) })) as Applied;

const BLACK = {
  type: "SOLID",
  color: {
    r: 0,
    g: 0,
    b: 0,
  },
};

let page: FakeNode;

const byId = (id: string) => page.children?.find((node) => node.id === id) as FakeNode;

beforeEach(() => {
  // FigJam's layers, with what Figma's typings give each: a sticky's and a shape's fill, a connector's stroke.
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "5:1",
        type: "STICKY",
        name: "Note",
        fills: [BLACK],
        opacity: 1,
      },
      {
        id: "5:2",
        type: "SHAPE_WITH_TEXT",
        name: "Box",
        fills: [BLACK],
        strokes: [BLACK],
        strokeWeight: 1,
        opacity: 1,
      },
      {
        id: "5:3",
        type: "CONNECTOR",
        name: "Arrow",
        strokes: [BLACK],
        strokeWeight: 1,
        opacity: 1,
      },
      {
        id: "5:4",
        type: "STAMP",
        name: "Stamp",
        fills: [BLACK],
        opacity: 1,
      },
    ],
  });
  installFigma(page);
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("apply: FigJam's layers, as Figma's typings let them change", () => {
  it("writes a sticky's and a shape's fill, a connector's stroke, their opacity, a stamp's size", async () => {
    const { errors } = await apply(
      [
        '<Sticky id="5:1" background="#FFEE00" opacity="0.5"/>',
        '<ShapeWithText id="5:2" background="#0000FF" border="2px solid #FF0000"/>',
        '<Connector id="5:3" border="3px solid #FF0000" opacity="0.8"/>',
        '<Stamp id="5:4" width="40px" height="40px"/>',
      ].join("\n"),
    );

    expect(errors).toEqual([]);
    expect(byId("5:1")).toMatchObject({
      fills: [
        expect.objectContaining({
          color: expect.objectContaining({
            r: 1,
            b: 0,
          }),
        }),
      ],
      opacity: 0.5,
    });
    expect(byId("5:2")).toMatchObject({
      fills: [expect.objectContaining({ color: expect.objectContaining({ b: 1 }) })],
      strokeWeight: 2,
    });
    expect(byId("5:3")).toMatchObject({
      strokeWeight: 3,
      opacity: 0.8,
    });
    expect(byId("5:4")).toMatchObject({
      width: 40,
      height: 40,
    });
  });

  it("places a sticky on the page by left and top", async () => {
    const { errors } = await apply('<Sticky id="5:1" position="absolute" left="120px" top="80px"/>');

    expect(errors).toEqual([]);
    expect(byId("5:1").relativeTransform).toEqual([
      [1, 0, 120],
      [0, 1, 80],
    ]);
  });

  it("still refuses what such a layer lacks, in plain words: a connector has no fill", async () => {
    const { errors } = await apply('<Connector id="5:3" background="#FFEE00"/>');

    expect(errors.map(({ message }) => message)).toEqual(["A connector has no fills."]);
  });
});
