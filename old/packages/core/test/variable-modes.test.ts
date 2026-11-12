import { describe, expect, it } from "vitest";
import {
  changeOf,
  designXml,
  modeAttribute,
  type RawTokens,
  readApply,
  type Snapshot,
  type SnapshotNode,
  tokenModel,
  tokensCss,
} from "../src/index.ts";

const frame = (id: string, fields: Partial<SnapshotNode> = {}): SnapshotNode => ({
  id,
  name: id === "1:1" ? "Page" : "Card",
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

describe("variable modes on layers: design_read", () => {
  it("writes a layer's modes as the data attributes tokens_read's CSS selects on", () => {
    const snapshot: Snapshot = {
      root: frame("1:1", {
        modes: [
          {
            collection: "Color modes",
            mode: "Dark",
          },
        ],
        children: [
          frame("1:2", {
            modes: [
              {
                collection: "Color modes",
                mode: "Light",
              },
              {
                collection: "Brand",
                mode: "Ocean Blue",
              },
            ],
          }),
        ],
      }),
      styles: {},
      variables: {},
    };

    expect(designXml(snapshot).xml).toBe(
      [
        '<Frame id="1:1" name="Page" data-color-modes="dark" width="200px" height="100px">',
        '  <Frame id="1:2" name="Card" data-color-modes="light" data-brand="ocean-blue" position="absolute" left="0" top="0" width="200px" height="100px"/>',
        "</Frame>",
      ].join("\n"),
    );
  });

  it("names the attribute as tokens_read names the collection's selectors", () => {
    expect(modeAttribute("Color modes")).toBe("data-color-modes");
    expect(modeAttribute("Тема")).toBe("data-тема");
  });
});

describe("variable modes on layers: design_apply", () => {
  it("sets a layer's mode from its data attribute, and clears it for an empty one", () => {
    const { elements, errors } = readApply('<Frame id="1:2" data-color-modes="dark" data-brand=""/>');

    expect(errors).toEqual([]);
    expect(elements.map((element) => changeOf(element).change.props)).toEqual([
      {
        modes: {
          "color-modes": "dark",
          brand: "",
        },
      },
    ]);
  });

  it("refuses a data attribute on a span: a run of text has no modes", () => {
    const { errors } = readApply('<Text id="1:3">Hi <Span data-theme="dark">there</Span></Text>');

    expect(errors.map(({ attribute }) => attribute)).toEqual(["data-theme"]);
  });
});

describe("variable modes on layers: tokens_read", () => {
  const raw: RawTokens = {
    collections: [
      {
        id: "C:1",
        name: "Theme",
        remote: false,
        defaultModeId: "M:light",
        modes: [
          {
            modeId: "M:light",
            name: "Light",
          },
          {
            modeId: "M:dark",
            name: "Dark",
          },
        ],
      },
    ],
    variables: [
      {
        id: "V:1",
        name: "bg",
        collectionId: "C:1",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        valuesByMode: {
          "M:light": {
            r: 1,
            g: 1,
            b: 1,
            a: 1,
          },
          "M:dark": {
            r: 0,
            g: 0,
            b: 0,
            a: 1,
          },
        },
      },
    ],
    external: {},
    styles: [],
  };

  it("gives the default mode a block of its own too, so a light card inside a dark page resets", () => {
    const model = tokenModel(raw);

    expect(model.collections[0]?.selectors).toEqual({
      Light: '[data-theme="light"]',
      Dark: '[data-theme="dark"]',
    });
    expect(tokensCss(model)).toBe(
      [
        ":root {",
        "  /* Theme */",
        "  --bg: #FFF;",
        "}",
        "",
        '[data-theme="light"] {',
        "  --bg: #FFF;",
        "}",
        "",
        '[data-theme="dark"] {',
        "  --bg: #000;",
        "}",
        "",
      ].join("\n"),
    );
  });
});
