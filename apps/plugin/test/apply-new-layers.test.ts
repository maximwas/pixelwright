import { type ApplyChange, type ApplyError, changeOf, readApply } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

interface Applied {
  created: { id: string }[];
  errors: ApplyError[];
}

function changesOf(xml: string): ApplyChange[] {
  const { elements, errors } = readApply(xml);

  expect(errors).toEqual([]);

  return elements.map((element) => changeOf(element).change);
}

const apply = async (xml: string) => (await plugin.run("apply", { changes: changesOf(xml) })) as Applied;

let writes: ReturnType<typeof installFigma>["writes"];

const created = (index: number) => writes.created[index] as FakeNode;

beforeEach(() => {
  const page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "2:1",
        type: "FRAME",
        name: "Row",
        layoutMode: "HORIZONTAL",
        width: 600,
        height: 40,
      },
    ],
  });

  ({ writes } = installFigma(page, {
    fonts: [
      {
        family: "Inter",
        style: "Regular",
      },
    ],
  }));
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("apply: new layers as Figma lays them out", () => {
  it("gives a new text that fills its row a width: Figma leaves one made at 0 wide at 0, a letter a line", async () => {
    const { errors } = await apply(
      '<Frame id="2:1"><Text flex="1" font="400 16px/24px \'Inter\'">What if the weather turns?</Text></Frame>',
    );

    expect(errors).toEqual([]);
    expect(created(0)).toMatchObject({
      type: "TEXT",
      layoutSizingHorizontal: "FILL",
    });
    expect(created(0).width).toBeGreaterThan(1);
  });

  it("draws a new frame's top border: the top side 1 px, the others none", async () => {
    const { errors } = await apply('<Frame name="Row" display="flex" border-top="1px solid #173126"/>');

    expect(errors).toEqual([]);
    expect(created(0)).toMatchObject({
      strokeTopWeight: 1,
      strokeRightWeight: 0,
      strokeBottomWeight: 0,
      strokeLeftWeight: 0,
    });
  });
});
