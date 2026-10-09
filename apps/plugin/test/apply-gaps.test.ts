import { type ApplyChange, type ApplyError, changeOf, readApply } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setEditsAllowed } from "../src/figma/edits.ts";
import { runOperation } from "../src/figma/operations.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";

interface Applied {
  created: { id: string }[];
  changed: string[];
  errors: ApplyError[];
}

function changesOf(xml: string): ApplyChange[] {
  const { elements, errors } = readApply(xml);

  expect(errors).toEqual([]);

  return elements.map((element) => changeOf(element).change);
}

const apply = async (xml: string, options: { dryRun?: boolean; parent?: string } = {}) =>
  (await runOperation("apply", {
    changes: changesOf(xml),
    ...options,
  })) as Applied;

const SHADOW = {
  type: "DROP_SHADOW",
  visible: true,
  blendMode: "MULTIPLY",
  color: {
    r: 25 / 255,
    g: 26 / 255,
    b: 35 / 255,
    a: 1,
  },
  offset: {
    x: 0,
    y: 5,
  },
  radius: 0,
  spread: 0,
  showShadowBehindNode: true,
  boundVariables: {
    color: {
      type: "VARIABLE_ALIAS",
      id: "V:shadow",
    },
  },
};
const NOISE = {
  type: "NOISE",
  visible: true,
  blendMode: "NORMAL",
  noiseType: "MONOTONE",
  noiseSize: 0.3,
  density: 0.5,
};
const PROGRESSIVE = {
  type: "LAYER_BLUR",
  visible: true,
  blurType: "PROGRESSIVE",
  radius: 8,
  startRadius: 0,
  startOffset: {
    x: 0.5,
    y: 0,
  },
  endOffset: {
    x: 0.5,
    y: 1,
  },
};

let root: FakeNode;
let fake: ReturnType<typeof installFigma>;
const byId = (id: string) => [root, ...(root.findAll?.(() => true) ?? [])].find((node) => node.id === id);

beforeEach(() => {
  root = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "4:1",
        name: "Card",
        effects: [SHADOW, NOISE, PROGRESSIVE],
      },
      {
        id: "4:2",
        name: "Other",
      },
    ],
  });
  fake = installFigma(root, {
    pages: [
      tree({
        id: "8:0",
        type: "PAGE",
        name: "Elsewhere",
        children: [
          {
            id: "8:1",
            name: "Swatch",
            fillStyleId: "S:far",
          },
        ],
      }),
    ],
    styles: {
      "S:far": {
        id: "S:far",
        type: "PAINT",
        name: "Far",
        remote: true,
        paints: [
          {
            type: "SOLID",
            visible: true,
            opacity: 1,
            blendMode: "NORMAL",
            color: {
              r: 1,
              g: 0,
              b: 0,
            },
          },
        ],
      },
    },
    teamLibrary: {
      collections: [
        {
          key: "LK:colors",
          libraryName: "DS",
          name: "Colors",
        },
      ],
      variables: {
        "LK:colors": [
          {
            name: "brand/accent",
            key: "VK:accent",
            resolvedType: "COLOR",
          },
        ],
      },
    },
    importable: {
      "VK:accent": {
        id: "L:accent",
        name: "brand/accent",
        resolvedType: "COLOR",
        variableCollectionId: "LC:colors",
        remote: true,
        valuesByMode: {},
      },
    },
  });
  setEditsAllowed(true);
});

afterEach(() => {
  setEditsAllowed(false);
});

describe("apply: effects CSS cannot write", () => {
  it("keeps noise and a progressive blur, and a shadow sent back unchanged keeps its variable and blend mode", async () => {
    const { errors } = await apply(
      '<Frame id="4:1" box-shadow="0 5px 0 0 #191A23, 0 2px 4px 0 rgba(0, 0, 0, 0.25)" filter="blur(4px)"/>',
    );
    const effects = byId("4:1")?.effects as Record<string, unknown>[];

    expect(errors).toEqual([]);
    expect(effects).toContainEqual(SHADOW);
    expect(effects).toContainEqual(NOISE);
    expect(effects).toContainEqual(PROGRESSIVE);
    expect(effects).toContainEqual(
      expect.objectContaining({
        type: "DROP_SHADOW",
        offset: {
          x: 0,
          y: 2,
        },
        radius: 4,
      }),
    );
    expect(effects).toHaveLength(4);
  });
});

describe("apply: tokens beyond the current page", () => {
  it("binds a variable of an enabled library the page does not use yet, importing it", async () => {
    const { errors } = await apply('<Frame id="4:2" background="var(--brand-accent)"/>');

    expect(errors).toEqual([]);
    expect(byId("4:2")?.fills).toMatchObject([{ boundVariables: { color: { id: "L:accent" } } }]);
  });

  it("checks such a variable on a dry run without importing it", async () => {
    const { errors } = await apply('<Frame id="4:2" background="var(--brand-accent)"/>', { dryRun: true });

    expect(errors).toEqual([]);
    expect(fake.writes.calls.map(({ method }) => method)).not.toContain("importVariableByKeyAsync");
  });

  it("reads no other page for a variable the current page already knows", async () => {
    const pages = await figma.variables.getLocalVariableCollectionsAsync();

    expect(pages).toEqual([]);

    const local = figma.variables.createVariableCollection("Theme");
    const ink = figma.variables.createVariable("ink", local, "COLOR");

    ink.setValueForMode(local.modes[0]?.modeId ?? "", {
      r: 0,
      g: 0,
      b: 0,
      a: 1,
    });
    fake.writes.calls.splice(0);

    const { errors } = await apply('<Frame id="4:2" background="var(--ink)"/>');

    expect(errors).toEqual([]);
    expect(fake.writes.calls.map(({ method }) => method)).not.toContain("loadAllPagesAsync");
  });

  it("finds a library style the file uses only on another page", async () => {
    const { errors } = await apply('<Frame id="4:2" background="var(--Far)"/>');

    expect(errors).toEqual([]);
    expect(byId("4:2")?.fillStyleId).toBe("S:far");
  });
});

describe("apply: dry runs", () => {
  it("never imports a library component named by key", async () => {
    const { errors } = await apply('<Instance component="key:heading-key"/>', {
      dryRun: true,
      parent: "4:2",
    });

    expect(errors).toEqual([]);
    expect(fake.writes.calls.map(({ method }) => method).filter((method) => method.startsWith("import"))).toEqual([]);
  });

  it("refuses before or after naming a layer that is not there", async () => {
    const { errors } = await apply('<Frame name="New" before="9:99"/>', { dryRun: true });

    expect(errors).toEqual([expect.objectContaining({ message: expect.stringMatching(/9:99/) })]);
  });
});
