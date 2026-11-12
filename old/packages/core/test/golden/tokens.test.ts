import { describe, expect, it } from "vitest";
import { dtcgTrees, TokensApplyInputSchema, tokenModel, tokensCss, tokensPlan } from "../../src/index.ts";
import { goldenTokens } from "./tokens-input.ts";

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** Bad values of every kind tokens_apply reads, so each reader's error stays word for word. */
const REFUSED = {
  collections: [
    {
      name: "Refused",
      variables: [
        {
          name: "Curve",
          type: "EASING",
          values: { Default: "ease-out" },
        },
        {
          name: "Width",
          type: "FLOAT",
          values: { Default: "12em" },
        },
        {
          name: "Guess",
          values: { Default: "nothing at all" },
        },
        {
          name: "Flag",
          type: "BOOLEAN",
          values: { Default: "yes" },
        },
      ],
    },
  ],
  styles: {
    paint: [
      {
        name: "Picture",
        value: "url(a.png)",
      },
      {
        name: "Nothing",
        value: "none",
      },
    ],
    text: [
      {
        name: "Loud",
        value: "bold",
      },
    ],
    effect: [
      {
        name: "Borrowed",
        value: "var(--Shadow-Card)",
      },
    ],
  },
};

/**
 * The token outputs as the code before the rewrite wrote them: the model, CSS, DTCG and the plan tokens_apply makes of
 * the model's own JSON, for an sRGB and a Display P3 file. A rewrite must reproduce them byte for byte.
 */
describe.each([
  ["srgb", undefined],
  ["p3", "DISPLAY_P3"],
])("golden tokens (%s)", (space, profile) => {
  const raw = goldenTokens(profile);
  const model = tokenModel(raw);

  it("keeps the token model", async () => {
    await expect(json(model)).toMatchFileSnapshot(`__golden__/tokens.${space}.model.json`);
  });

  it("keeps the CSS", async () => {
    await expect(tokensCss(model)).toMatchFileSnapshot(`__golden__/tokens.${space}.css`);
  });

  it("keeps the DTCG trees", async () => {
    await expect(json(dtcgTrees(raw))).toMatchFileSnapshot(`__golden__/tokens.${space}.dtcg.json`);
  });

  it("keeps the plan of the model fed back", async () => {
    const input = TokensApplyInputSchema.parse({
      collections: model.collections,
      styles: model.styles,
    });

    await expect(json(tokensPlan(input))).toMatchFileSnapshot(`__golden__/tokens.${space}.plan.json`);
  });
});

describe("golden tokens plan errors", () => {
  it("keeps each refusal", async () => {
    await expect(json(tokensPlan(TokensApplyInputSchema.parse(REFUSED)))).toMatchFileSnapshot(
      "__golden__/tokens.refused.plan.json",
    );
  });
});
