import { describe, expect, it } from "vitest";
import {
  designHints,
  designXml,
  type RawTokens,
  type Snapshot,
  type SnapshotNode,
  type SnapshotStyle,
  tokenModel,
} from "../src/index.ts";

/** What a second real build (six screens of a client project) found missing or wrong (stage 8). */

const GRADIENT = "radial-gradient(144.83% 129.61% at 97.4% 5.56%, #9D3535 0%, #D96837 69.91%, #E29B6A 100%)";
const RADIAL = {
  type: "GRADIENT_RADIAL",
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
