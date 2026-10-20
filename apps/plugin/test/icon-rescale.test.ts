import { type ApplyChange, changeOf, readApply } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

interface Applied {
  changed: string[];
  errors: { message: string; attribute?: string }[];
}

function changesOf(xml: string): ApplyChange[] {
  const { elements, errors } = readApply(xml);

  expect(errors).toEqual([]);

  return elements.map((element) => changeOf(element).change);
}

const apply = async (xml: string) => (await plugin.run("apply", { changes: changesOf(xml) })) as Applied;

let root: FakeNode;
let fake: ReturnType<typeof installFigma>;
const all = (from: FakeNode): FakeNode[] => [from, ...(from.children ?? []).flatMap(all)];
const byId = (id: string) => all(root).find((node) => node.id === id) as FakeNode;
const rescales = () => fake.writes.calls.filter(({ method }) => method === "rescale");

/** A 24 px icon frame holding a vector drawn with a 2 px line, and a bare vector whose centred line reaches past it. */
beforeEach(() => {
  root = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "6:1",
        name: "Arrow",
        absoluteBoundingBox: {
          x: 0,
          y: 0,
          width: 24,
          height: 24,
        },
        children: [
          {
            id: "6:2",
            type: "VECTOR",
            name: "Line",
            strokeWeight: 2,
            absoluteBoundingBox: {
              x: 4,
              y: 4,
              width: 16,
              height: 16,
            },
          },
        ],
      },
      {
        id: "6:3",
        type: "VECTOR",
        name: "Check",
        strokeWeight: 2,
        absoluteBoundingBox: {
          x: 40,
          y: 0,
          width: 20,
          height: 20,
        },
        absoluteRenderBounds: {
          x: 39,
          y: -1,
          width: 22,
          height: 22,
        },
      },
    ],
  });
  fake = installFigma(root);
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("apply: an existing Icon's size", () => {
  it("scales the icon with its lines, as a new one is sized, and lists it as changed", async () => {
    const { changed, errors } = await apply('<Icon id="6:1" width="48px"/>');

    expect(errors).toEqual([]);
    expect(changed).toEqual(["6:1"]);
    expect(byId("6:1")).toMatchObject({
      width: 48,
      height: 48,
    });
    expect(byId("6:2").strokeWeight).toBe(4);
  });

  it("scales by the box design_read gives it, the line reaching past the vector included", async () => {
    await apply('<Icon id="6:3" width="44px"/>');

    expect(rescales().map(({ args }) => args)).toEqual([[2]]);
    expect(byId("6:3").width).toBe(40);
  });

  it("scales by its height when only that is given, and by its width when both are (the drawing keeps its ratio)", async () => {
    await apply('<Icon id="6:1" height="12px"/>');

    expect(byId("6:1").width).toBe(12);

    await apply('<Icon id="6:1" width="36px" height="20px"/>');

    expect(byId("6:1")).toMatchObject({
      width: 36,
      height: 36,
    });
  });

  it("rescales nothing at the size it has, so design_read's own XML writes nothing", async () => {
    await expect(apply('<Icon id="6:1" width="24px" height="24px"/>')).resolves.toMatchObject({ changed: [] });
    expect(rescales()).toEqual([]);
  });

  it("only resizes a Frame, its lines staying as they are", async () => {
    await apply('<Frame id="6:1" width="48px" height="48px"/>');

    expect(rescales()).toEqual([]);
    expect(byId("6:2").strokeWeight).toBe(2);
  });
});
