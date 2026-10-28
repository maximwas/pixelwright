import { describe, expect, it } from "vitest";
import {
  designHints,
  designTree,
  designXml,
  type RawTokens,
  type Snapshot,
  type SnapshotNode,
  type SnapshotStyle,
  tokenModel,
  tokensCss,
} from "../src/index.ts";

/** What a second real build (six screens of a client project) found missing or wrong (stage 8). */

const GRADIENT = "radial-gradient(144.83% 129.61% at 97.4% 5.56%, #9D3535 0%, #D96837 69.91%, #E29B6A 100%)";
/** A diamond gradient: CSS has none, so core writes no value of its own and takes Figma's CSS of the layer. */
const RADIAL = {
  type: "GRADIENT_DIAMOND",
  visible: true,
  gradientStops: [
    {
      position: 0,
      color: {
        r: 0.616,
        g: 0.208,
        b: 0.208,
        a: 1,
      },
    },
  ],
  gradientTransform: [
    [1, 0, 0],
    [0, 1, 0],
  ],
};
const GRADIENT_STYLE: SnapshotStyle = {
  name: "Brand Gradient",
  type: "PAINT",
  remote: true,
  paints: [RADIAL],
};

const layer = (fields: Partial<SnapshotNode> & { id: string }): SnapshotNode => ({
  name: fields.id,
  type: "RECTANGLE",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const snapshotOf = (root: SnapshotNode, styles: Snapshot["styles"] = {}): Snapshot => ({
  root,
  styles,
  variables: {},
});

describe("a paint style's value", () => {
  it("comes from the layer's own CSS when core cannot write the style's paints", () => {
    const read = designXml(
      snapshotOf(
        layer({
          id: "1:2",
          name: "Button",
          fills: [RADIAL],
          fillStyleId: "S:g",
          css: { background: GRADIENT },
        }),
        { "S:g": GRADIENT_STYLE },
      ),
    );

    expect(read.xml).toContain('background="var(--Brand-Gradient)"');
    expect(read.tokens["--Brand-Gradient"]).toBe(GRADIENT);
  });

  it("unwraps a var() Figma wrote around the value", () => {
    const read = designXml(
      snapshotOf(
        layer({
          id: "1:2",
          fills: [RADIAL],
          fillStyleId: "S:g",
          css: { background: `var(--Brand-Gradient, ${GRADIENT})` },
        }),
        { "S:g": GRADIENT_STYLE },
      ),
    );

    expect(read.tokens["--Brand-Gradient"]).toBe(GRADIENT);
  });

  it("is hinted when there is none to give, never left as a bare var()", () => {
    const snapshot = snapshotOf(
      layer({
        id: "1:2",
        fills: [RADIAL],
        fillStyleId: "S:g",
      }),
      { "S:g": GRADIENT_STYLE },
    );

    expect(designHints(snapshot).join("\n")).toMatch(/--Brand-Gradient has no value/);
  });

  it("is a token in tokens_read when a layer that uses the style gave its CSS", () => {
    const raw: RawTokens = {
      collections: [],
      variables: [],
      external: {},
      styles: [
        {
          id: "S:g",
          ...GRADIENT_STYLE,
          css: GRADIENT,
        },
      ],
    };
    const model = tokenModel(raw);

    expect(model.styles.paint).toEqual([
      {
        name: "Brand Gradient",
        token: "--Brand-Gradient",
        value: GRADIENT,
      },
    ]);
    expect(model.notes.join("\n")).not.toMatch(/only a single solid color/);
  });
});

const WHITE = {
  type: "SOLID",
  visible: true,
  color: {
    r: 1,
    g: 1,
    b: 1,
  },
};

describe("what the read says in hints, not in $css", () => {
  it("writes a centred stroke as plain CSS, and explains it in a hint", () => {
    const snapshot = snapshotOf(
      layer({
        id: "1:1",
        type: "FRAME",
        width: 400,
        height: 300,
        children: [
          layer({
            id: "1:2",
            name: "Card",
            strokes: [WHITE],
            strokeWeight: 1,
            strokeAlign: "CENTER",
          }),
        ],
      }),
    );
    const read = designXml(snapshot);

    expect(read.xml).toContain('$css="stroke-align: center"');
    expect(designHints(snapshot, designTree(snapshot)).join("\n")).toMatch(/stroke centred on its edge \(1:2 "Card"\)/);
  });

  it("names a numbered style token with its value and the one it shares the name with", () => {
    const snapshot = snapshotOf(
      layer({
        id: "1:1",
        type: "FRAME",
        width: 400,
        height: 300,
        children: [
          layer({
            id: "1:2",
            fills: [WHITE],
            fillStyleId: "S:1",
          }),
          layer({
            id: "1:3",
            fills: [WHITE],
            fillStyleId: "S:2",
          }),
        ],
      }),
      {
        "S:1": {
          name: "White",
          type: "PAINT",
          remote: true,
          paints: [WHITE],
        },
        "S:2": {
          name: "White",
          type: "PAINT",
          remote: true,
          paints: [WHITE],
          duplicate: 2,
        },
      },
    );

    expect(designHints(snapshot).join("\n")).toMatch(
      /--White-2 is another paint style named White \(#FFF\); --White is #FFF: they are two styles/,
    );
  });
});

describe("text style tokens", () => {
  it("carry the letter spacing and case design_read gives the style, as tokens of their own", () => {
    const model = tokenModel({
      collections: [],
      variables: [],
      external: {},
      styles: [
        {
          id: "S:c",
          name: "Caption",
          type: "TEXT",
          remote: true,
          fontName: {
            family: "Manrope",
            style: "SemiBold",
          },
          fontSize: 12,
          lineHeight: {
            unit: "PIXELS",
            value: 18,
          },
          letterSpacing: {
            unit: "PERCENT",
            value: 3,
          },
          textCase: "UPPER",
        },
      ],
    });

    expect(model.styles.text[0]).toMatchObject({
      token: "--Caption-font",
      also: [
        {
          token: "--Caption-letter-spacing",
          value: "0.03em",
        },
        {
          token: "--Caption-text-transform",
          value: "uppercase",
        },
      ],
    });
    expect(tokensCss(model)).toContain("--Caption-letter-spacing: 0.03em;");
  });
});

describe("layout grids", () => {
  it("are written as a read-only layout-grid, columns and a square grid alike", () => {
    const { xml } = designXml(
      snapshotOf(
        layer({
          id: "1:1",
          type: "FRAME",
          width: 1440,
          height: 900,
          layoutGrids: [
            {
              pattern: "COLUMNS",
              alignment: "STRETCH",
              count: 12,
              gutterSize: 24,
              offset: 80,
              visible: true,
            },
            {
              pattern: "GRID",
              sectionSize: 8,
              visible: true,
            },
          ],
        }),
      ),
    );

    expect(xml).toContain('$css="layout-grid: 12 columns stretch, gutter 24px, margin 80px + 8px grid"');
  });
});

describe("a component's layers bound to its properties (Dukach feedback)", () => {
  it("say which property shows them, sets their text or swaps them, read-only and without the #id", () => {
    const { xml } = designXml(
      snapshotOf(
        layer({
          id: "1:1",
          type: "COMPONENT",
          name: "Row",
          layoutMode: "VERTICAL",
          children: [
            layer({
              id: "1:2",
              type: "FRAME",
              name: "Subtitle",
              minHeight: 44,
              componentPropertyReferences: { visible: "Show subtitle#12:0" },
            }),
            layer({
              id: "1:3",
              type: "INSTANCE",
              name: "Icon",
              instance: {
                componentId: "9:1",
                componentName: "icon/Bell",
                properties: {},
              },
              componentPropertyReferences: {
                mainComponent: "Icon#12:1",
                visible: "Show icon#12:2",
              },
            }),
          ],
        }),
      ),
    );

    expect(xml).toMatch(/<Frame id="1:2" name="Subtitle" [^>]*min-height="44px"[^>]*\$visibleProp="Show subtitle"/);
    expect(xml).toMatch(/<Instance id="1:3" [^>]*\$visibleProp="Show icon" \$swapProp="Icon"/);
  });
});
