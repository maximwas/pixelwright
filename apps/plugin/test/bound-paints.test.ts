import { type ApplyChange, changeOf, readApply } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { opacitiesAgain } from "../src/figma/paints.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/** A hairline colour: a variable with alpha, as a design system keeps its lines. */
const LINE = {
  r: 23 / 255,
  g: 49 / 255,
  b: 38 / 255,
  a: 0.14,
};

const bound = (opacity: number, id = "V:line"): SolidPaint => ({
  type: "SOLID",
  color: {
    r: LINE.r,
    g: LINE.g,
    b: LINE.b,
  },
  opacity,
  boundVariables: {
    color: {
      type: "VARIABLE_ALIAS",
      id,
    },
  },
});

function changesOf(xml: string): ApplyChange[] {
  const { elements, errors } = readApply(xml);

  expect(errors).toEqual([]);

  return elements.map((element) => changeOf(element).change);
}

let page: FakeNode;

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        type: "RECTANGLE",
        name: "Rule",
        fills: [],
      },
    ],
  });
  installFigma(page, {
    localCollections: [
      {
        id: "C:1",
        name: "Brand",
        remote: false,
        defaultModeId: "M:1",
        modes: [
          {
            modeId: "M:1",
            name: "Light",
          },
        ],
      },
    ],
    localVariables: [
      {
        id: "V:line",
        name: "line",
        variableCollectionId: "C:1",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        codeSyntax: {},
        valuesByMode: { "M:1": LINE },
      },
    ],
  });
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("apply: a paint bound to a colour variable with alpha", () => {
  it("is made of the variable's colour and alpha, an opacity past it on top, not of a black placeholder", async () => {
    await plugin.run("apply", {
      changes: changesOf('<Rectangle id="1:1" background="color-mix(in srgb, var(--line) 50%, transparent)"/>'),
    });

    const paint = (page.children?.[0]?.fills as SolidPaint[] | undefined)?.[0];

    expect(paint?.boundVariables?.color?.id).toBe("V:line");
    expect(paint?.color.r).toBeCloseTo(LINE.r, 4);
    expect(paint?.color.g).toBeCloseTo(LINE.g, 4);
    expect(paint?.opacity).toBeCloseTo(0.07, 4);
  });
});

describe("opacitiesAgain", () => {
  it("sets back the opacity Figma replaced with the variable's alpha when it bound the paint", () => {
    expect(opacitiesAgain([bound(0.14)], [bound(0.07)])).toEqual([bound(0.07)]);
  });

  it("asks nothing when the paints hold the opacities wanted, or none is bound", () => {
    expect(opacitiesAgain([bound(0.14)], [bound(0.14)])).toBeNull();
    expect(
      opacitiesAgain(
        [
          {
            type: "SOLID",
            color: {
              r: 0,
              g: 0,
              b: 0,
            },
            opacity: 0.4,
          },
        ],
        [
          {
            type: "SOLID",
            color: {
              r: 0,
              g: 0,
              b: 0,
            },
            opacity: 0.5,
          },
        ],
      ),
    ).toBeNull();
  });
});
