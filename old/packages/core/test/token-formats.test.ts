import { describe, expect, it } from "vitest";
import { dtcgTrees, TOKEN_FORMATS, tokenModel, tokensCss } from "../src/index.ts";
import { goldenTokens } from "./golden/tokens-input.ts";

const raw = goldenTokens();
const model = tokenModel(raw);
const source = {
  raw,
  model,
  filter: {},
};

describe("token formats", () => {
  it("writes css as the stylesheet with a summary of what it holds; the size is the stylesheet's", () => {
    const css = tokensCss(model);
    const written = TOKEN_FORMATS.css.write(source);

    expect(written.body).toEqual({
      css,
      summary: {
        collections: [
          {
            name: "Brand Colors",
            modes: ["Light", "Dark", "dark"],
            variables: 4,
          },
          {
            name: "Spacing",
            modes: ["Base"],
            variables: 8,
          },
          {
            name: "Motion",
            modes: ["Default"],
            variables: 4,
          },
        ],
        styles: {
          paint: 3,
          text: 2,
          effect: 1,
        },
      },
    });
    expect(written.notes).toEqual([]);
    expect(written.size).toBe(css.length);
  });

  it("writes json as the model's collections and styles; the size is their JSON's", () => {
    const tokens = {
      collections: model.collections,
      styles: model.styles,
    };
    const written = TOKEN_FORMATS.json.write(source);

    expect(written.body).toEqual({ tokens });
    expect(written.notes).toEqual([]);
    expect(written.size).toBe(JSON.stringify(tokens).length);
  });

  it("writes dtcg as the trees, with DTCG's own notes; the size is the trees' JSON", () => {
    const { trees, notes } = dtcgTrees(raw);
    const written = TOKEN_FORMATS.dtcg.write(source);

    expect(written.body).toEqual({ dtcg: trees });
    expect(written.notes).toEqual(notes);
    expect(written.notes.length).toBeGreaterThan(0);
    expect(written.size).toBe(JSON.stringify(trees).length);
  });

  it("takes only the collections asked for in dtcg", () => {
    const written = TOKEN_FORMATS.dtcg.write({
      ...source,
      filter: { collections: ["spacing"] },
    });

    expect(Object.keys((written.body as { dtcg: object }).dtcg)).toEqual(["spacing", "styles"]);
  });
});
