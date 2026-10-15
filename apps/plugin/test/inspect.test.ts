import { describe, expect, it } from "vitest";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const DARK = {
  r: 0.098,
  g: 0.102,
  b: 0.137,
};

/** A section with a card whose title overflows it, and a rule whose centred stroke paints half a pixel above. */
const page = () =>
  tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "5:2",
        type: "COMPONENT",
        name: "Type=Hover",
      },
      {
        id: "2:1",
        type: "SECTION",
        name: "Section",
        absoluteBoundingBox: {
          x: 100,
          y: 100,
          width: 800,
          height: 600,
        },
        children: [
          {
            id: "2:2",
            type: "FRAME",
            name: "Card",
            absoluteBoundingBox: {
              x: 120,
              y: 130,
              width: 297,
              height: 200,
            },
            layoutMode: "VERTICAL",
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            children: [
              {
                id: "2:3",
                type: "TEXT",
                name: "Title",
                absoluteBoundingBox: {
                  x: 120,
                  y: 130,
                  width: 306,
                  height: 38,
                },
                characters: "Behind Your",
                textAutoResize: "HEIGHT",
                textAlignHorizontal: "LEFT",
                textAlignVertical: "TOP",
                segments: [
                  {
                    characters: "Behind Your",
                    start: 0,
                    end: 11,
                    fontName: {
                      family: "Inter",
                      style: "Regular",
                    },
                    fontSize: 16,
                    fontWeight: 400,
                    textDecoration: "NONE",
                    textCase: "ORIGINAL",
                    lineHeight: { unit: "AUTO" },
                    letterSpacing: {
                      unit: "PIXELS",
                      value: 0,
                    },
                    fills: [],
                    fillStyleId: "",
                    textStyleId: "",
                  },
                ],
              },
            ],
          },
          {
            id: "2:4",
            type: "LINE",
            name: "Rule",
            absoluteBoundingBox: {
              x: 100,
              y: 200,
              width: 100,
              height: 0,
            },
            absoluteRenderBounds: {
              x: 99.5,
              y: 199.5,
              width: 101,
              height: 1,
            },
            strokes: [
              {
                type: "SOLID",
                visible: true,
                opacity: 1,
                color: DARK,
              },
            ],
            strokeWeight: 1,
            strokeAlign: "CENTER",
            reactions: [
              {
                trigger: { type: "ON_HOVER" },
                actions: [
                  {
                    type: "NODE",
                    destinationId: "5:2",
                    navigation: "CHANGE_TO",
                    transition: {
                      type: "SMART_ANIMATE",
                      duration: 0.3,
                      easing: { type: "EASE_OUT" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

describe("inspect", () => {
  it("reads layers from a section's top left, with Allow edits off, and names the ids it could not find", async () => {
    installFigma(page());

    const raw = (await plugin.run("inspect", {
      nodes: ["2:3", "2:4", "9:9"],
      relativeTo: "2:1",
    })) as {
      origin: { id: string; name: string } | null;
      layers: Record<string, unknown>[];
      missing: string[];
    };

    expect(raw.origin).toEqual({
      id: "2:1",
      name: "Section",
    });
    expect(raw.missing).toEqual(["9:9"]);
    expect(raw.layers[0]).toMatchObject({
      id: "2:3",
      parent: {
        id: "2:2",
        name: "Card",
        type: "FRAME",
      },
      box: {
        x: 20,
        y: 30,
        width: 306,
        height: 38,
      },
      parentBox: {
        x: 20,
        y: 30,
        width: 297,
        height: 200,
      },
      parentPadding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
      text: {
        characters: "Behind Your",
      },
    });
    expect(raw.layers[1]).toMatchObject({
      id: "2:4",
      box: {
        x: 0,
        y: 100,
        width: 100,
        height: 0,
      },
      paintedBox: {
        x: -0.5,
        y: 99.5,
        width: 101,
        height: 1,
      },
      strokeAlign: "CENTER",
      reactions: [{ actions: [{ destinationName: "Type=Hover" }] }],
    });
  });

  it("measures from the page without relativeTo", async () => {
    installFigma(page());

    const raw = (await plugin.run("inspect", { nodes: ["2:4"] })) as {
      origin: unknown;
      layers: { box: unknown }[];
    };

    expect(raw.origin).toBeNull();
    expect(raw.layers[0]?.box).toEqual({
      x: 100,
      y: 200,
      width: 100,
      height: 0,
    });
  });
  it("says the file's colour profile, so a P3 file's colours are written as such", async () => {
    const { figma } = installFigma(page());

    expect(await plugin.run("inspect", { nodes: ["2:4"] })).not.toHaveProperty("colorProfile");

    Object.assign(figma.root, { documentColorProfile: "DISPLAY_P3" });

    expect(await plugin.run("inspect", { nodes: ["2:4"] })).toMatchObject({ colorProfile: "DISPLAY_P3" });
  });
});

describe("inspect fills", () => {
  it("carries the styles the layers use, so their fills name them", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "3:1",
            type: "RECTANGLE",
            name: "Swatch",
            fills: [
              {
                type: "SOLID",
                visible: true,
                opacity: 1,
                color: DARK,
              },
            ],
            fillStyleId: "S:d",
          },
        ],
      }),
      {
        styles: {
          "S:d": {
            id: "S:d",
            name: "Dark",
            type: "PAINT",
            remote: true,
            paints: [
              {
                type: "SOLID",
                visible: true,
                opacity: 1,
                color: DARK,
              },
            ],
          },
        },
      },
    );

    const raw = (await plugin.run("inspect", { nodes: ["3:1"] })) as { styles?: Record<string, { name: string }> };

    expect(raw.styles?.["S:d"]?.name).toBe("Dark");
  });
});
