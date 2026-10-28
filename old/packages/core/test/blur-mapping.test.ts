import { describe, expect, it } from "vitest";
import {
  changeOf,
  designXml,
  effectsValue,
  readApply,
  type SnapshotEffect,
  type SnapshotNode,
  TokensApplyInputSchema,
  tokensPlan,
  unchangedAttributes,
} from "../src/index.ts";

/** Figma renders a blur of radius R as CSS blur(0.43 R) does (measured live), not as Dev Mode's blur(R / 2). */

const blur = (type: "LAYER_BLUR" | "BACKGROUND_BLUR", radius: number): SnapshotEffect => ({
  type,
  visible: true,
  radius,
});

const frame = (effects: SnapshotEffect[]): SnapshotNode => ({
  id: "1:1",
  name: "Glass",
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  childCount: 0,
  effects,
});

const read = (node: SnapshotNode) =>
  designXml({
    root: node,
    styles: {},
    variables: {},
  }).xml;

const written = (xml: string) => {
  const [element] = readApply(xml).elements;

  return element === undefined ? undefined : changeOf(element).change.props.effects;
};

describe("blur mapping", () => {
  it("reads a layer blur of radius 20 as blur(8.6px), and a background blur alike", () => {
    expect(read(frame([blur("LAYER_BLUR", 20)]))).toContain('filter="blur(8.6px)"');
    expect(read(frame([blur("BACKGROUND_BLUR", 20)]))).toContain('backdrop-filter="blur(8.6px)"');
  });

  it("keeps two decimals at most", () => {
    expect(read(frame([blur("LAYER_BLUR", 13.3)]))).toContain('filter="blur(5.72px)"');
  });

  it("writes blur(8.6px) as radius 20, on filter and backdrop-filter", () => {
    expect(written('<Frame id="1:1" filter="blur(8.6px)" backdrop-filter="blur(8.6px)"/>')).toEqual([
      {
        type: "LAYER_BLUR",
        radius: 20,
      },
      {
        type: "BACKGROUND_BLUR",
        radius: 20,
      },
    ]);
  });

  it("maps an effect style's blur alike, written by tokens_apply and matched by tokens_bind", () => {
    const glass = {
      name: "Glass",
      value: "0 1px 2px 0 #000; backdrop-filter: blur(8.6px)",
    };
    const { plan } = tokensPlan(TokensApplyInputSchema.parse({ styles: { effect: [glass] } }));

    expect(plan.styles.effect[0]?.effects[0]).toEqual({
      type: "BACKGROUND_BLUR",
      radius: 20,
    });
    expect(effectsValue([blur("LAYER_BLUR", 20)])).toBe("filter: blur(8.6px)");
  });

  it("writes nothing when the read is sent back", () => {
    const node = frame([blur("LAYER_BLUR", 20), blur("BACKGROUND_BLUR", 13.3)]);
    const [element] = readApply(read(node)).elements;

    if (element === undefined) {
      throw new Error("nothing read");
    }

    const now = unchangedAttributes(
      element,
      {
        node,
        parent: null,
      },
      {
        styles: {},
        variables: {},
      },
    );

    expect([...now.attributes]).toEqual(expect.arrayContaining(["filter", "backdrop-filter"]));
    expect(changeOf(element, now).change.props.effects).toBeUndefined();
  });
});
