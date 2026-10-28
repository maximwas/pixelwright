import { describe, expect, it } from "vitest";
import {
  attributeProps,
  type CssContext,
  nodeCss,
  type RawTokens,
  type SnapshotNode,
  styleValueOf,
  tokenModel,
  tokenUsesOf,
} from "../src/index.ts";

const SHADOW_COLOR = {
  r: 0.08,
  g: 0.09,
  b: 0.12,
  a: 0.16,
};

/** A shadow 0 4px 12px 0 whose colour is bound to the variable V:shadow, as Figma keeps one. */
const BOUND_SHADOW = {
  type: "DROP_SHADOW",
  visible: true,
  color: SHADOW_COLOR,
  offset: {
    x: 0,
    y: 4,
  },
  radius: 12,
  spread: 0,
  boundVariables: {
    color: {
      type: "VARIABLE_ALIAS",
      id: "V:shadow",
    },
  },
};

const VARIABLE = {
  name: "shadow/soft",
  collection: "Theme",
  resolvedType: "COLOR",
  remote: false,
  value: SHADOW_COLOR,
};

function cssOf(node: Partial<SnapshotNode>, tokens = new Map<string, string>()) {
  const layer = {
    id: "1:1",
    name: "Card",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    childCount: 0,
    ...node,
  } as SnapshotNode;
  const context: CssContext = {
    styles: {},
    variables: { "V:shadow": VARIABLE },
    tokens,
    root: layer,
  };

  return Object.fromEntries(nodeCss(layer, null, context).properties);
}

describe("a shadow's colour from a colour variable", () => {
  it("is read as var() with the variable's value in the tokens, on a box and on a text", () => {
    const tokens = new Map<string, string>();

    expect(cssOf({ effects: [BOUND_SHADOW] }, tokens)["box-shadow"]).toBe("0 4px 12px 0 var(--shadow-soft)");
    expect(Object.fromEntries(tokens)).toEqual({ "--shadow-soft": "rgba(20, 23, 31, 0.16)" });
    expect(
      cssOf({
        effects: [
          {
            ...BOUND_SHADOW,
            type: "INNER_SHADOW",
          },
        ],
      })["box-shadow"],
    ).toBe("inset 0 4px 12px 0 var(--shadow-soft)");
    expect(
      cssOf({
        type: "TEXT",
        effects: [BOUND_SHADOW],
      })["text-shadow"],
    ).toBe("0 4px 12px var(--shadow-soft)");
  });

  it("is written as the shadow's token, inset and on a text too", () => {
    const shadow = {
      type: "DROP_SHADOW",
      color: null,
      token: "--shadow-soft",
      x: 0,
      y: 4,
      radius: 12,
      spread: 0,
    };

    expect(attributeProps("Frame", "box-shadow", "0 4px 12px 0 var(--shadow-soft)")).toEqual({
      props: { effects: [shadow] },
      errors: [],
    });
    expect(attributeProps("Frame", "box-shadow", "inset 0 4px 12px var(--shadow-soft)").props.effects).toEqual([
      {
        ...shadow,
        type: "INNER_SHADOW",
      },
    ]);
    expect(attributeProps("Text", "text-shadow", "0 4px 12px var(--shadow-soft)").props.effects).toEqual([shadow]);
  });

  it("refuses a variable mixed with transparent: the variable is the shadow's whole colour, its alpha too", () => {
    expect(
      attributeProps("Frame", "box-shadow", "0 4px 12px 0 color-mix(in srgb, var(--shadow-soft) 50%, transparent)")
        .errors,
    ).toEqual([expect.stringMatching(/whole colour.*tokens_apply/)]);
  });

  it("is a colour token a dry run checks", () => {
    const { props } = attributeProps("Frame", "box-shadow", "0 4px 12px 0 var(--shadow-soft), 0 1px 2px 0 #000");

    expect(tokenUsesOf(props)).toEqual([
      {
        key: "effects",
        token: "--shadow-soft",
        kind: "COLOR",
      },
    ]);
  });

  it("is a var() in an effect style's value, read back by tokens_read and taken by tokens_apply", () => {
    const raw: RawTokens = {
      collections: [
        {
          id: "C:1",
          name: "Theme",
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
      variables: [
        {
          id: "V:shadow",
          name: "shadow/soft",
          collectionId: "C:1",
          resolvedType: "COLOR",
          scopes: ["ALL_SCOPES"],
          valuesByMode: { "M:1": SHADOW_COLOR },
        },
      ],
      external: {},
      styles: [
        {
          id: "S:card",
          name: "Card",
          type: "EFFECT",
          remote: false,
          effects: [BOUND_SHADOW],
        },
      ],
    };
    const [style] = tokenModel(raw).styles.effect;

    expect(style?.value).toBe("0 4px 12px 0 var(--shadow-soft)");
    expect(styleValueOf("effect", style?.value ?? "")).toEqual({
      effects: [
        {
          type: "DROP_SHADOW",
          color: null,
          token: "--shadow-soft",
          x: 0,
          y: 4,
          radius: 12,
          spread: 0,
        },
      ],
      covers: ["DROP_SHADOW", "INNER_SHADOW"],
    });
  });
});
