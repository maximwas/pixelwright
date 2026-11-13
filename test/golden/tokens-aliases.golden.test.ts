import { describe, expect, it } from "vitest";
import { plan } from "./support/tokens-planner.ts";

/** The golden file's Brand Colors collection (modes Light, Dark, dark) given these variables, as a client sends them. */
function brand(variables: unknown[]) {
  return plan({ collections: [{ name: "Brand Colors", variables }] });
}

const refused = (planned: ReturnType<typeof plan>) =>
  planned.errors.map(({ name, mode, message }) => ({ name, ...(mode === undefined ? {} : { mode }), message }));

const planned = (planned: ReturnType<typeof plan>) =>
  planned.plan.collections.flatMap(({ variables }) => variables.map(({ name, type }) => [name, type]));

describe("golden tokens plan: aliases", () => {
  // The target's type is the variable's own, so Figma's scope rules apply to it as to any other.
  it("checks the scopes of a new variable whose values are all aliases by its target's type", () => {
    const result = brand([
      { name: "Wrong", values: { Light: "var(--Ink)" }, scopes: ["ALL_SCOPES", "GAP"] },
      { name: "Alone", values: { Light: "var(--Ink)" }, scopes: ["ALL_SCOPES", "FRAME_FILL"] },
      { name: "Right", values: { Light: "var(--Ink)" }, scopes: ["FRAME_FILL"] },
    ]);

    expect(refused(result)).toEqual([
      {
        name: "Wrong",
        message:
          "A COLOR variable cannot take GAP: its scopes are ALL_SCOPES, ALL_FILLS, FRAME_FILL, SHAPE_FILL, TEXT_FILL, STROKE_COLOR, EFFECT_COLOR.",
      },
      { name: "Alone", message: "ALL_SCOPES stands alone: it already offers the variable for every field." },
    ]);
    expect(planned(result)).toEqual([["Right", "COLOR"]]);
  });

  it("gives an alias the id of its target when the file holds it, and none when the call makes it", () => {
    const result = brand([
      { name: "Link", values: { Light: "var(--Ink)", Dark: "var(--Accent)" } },
      { name: "Near", values: { Light: "var(--Link)" } },
    ]);
    const [link, near] = result.plan.collections[0]?.variables ?? [];

    expect(link?.values).toEqual({
      Light: { kind: "alias", token: "--Ink", id: "V:ink" },
      Dark: { kind: "alias", token: "--Accent", id: "V:lib-accent" },
    });
    expect(near).toMatchObject({ type: "COLOR", values: { Light: { kind: "alias", token: "--Link" } } });
    expect(near?.values.Light).not.toHaveProperty("id");
  });

  it("refuses aliases that lead back to themselves, on the dry run", () => {
    const result = brand([
      { name: "P1", values: { Light: "var(--P2)" } },
      { name: "P2", values: { Light: "var(--P1)" } },
      { name: "P3", values: { Light: "var(--P3)" } },
    ]);

    expect(refused(result)).toEqual([
      { name: "P1", mode: "Light", message: expect.stringContaining("--P1 → --P2 → --P1") },
      { name: "P2", mode: "Light", message: expect.stringContaining("--P2 → --P1 → --P2") },
      { name: "P3", mode: "Light", message: expect.stringContaining("--P3 → --P3") },
    ]);
    expect(result.created).toEqual([]);
  });

  it("refuses a loop through a variable the call changes, and through the file's own aliases", () => {
    const result = brand([
      { name: "Ink", values: { Light: "var(--Fresh)" } },
      { name: "Fresh", values: { Light: "var(--Ink)" } },
      // Surface/Base holds Ink in Dark: Ink pointing at it closes the loop.
      { name: "Veil", values: { Light: "var(--surface)" } },
    ]);

    expect(refused(result).map(({ name }) => name)).toEqual(["Ink", "Fresh"]);
    expect(planned(result)).toEqual([["Veil", "COLOR"]]);
    expect(
      refused(brand([{ name: "Ink", values: { Light: "var(--surface)" } }])).map(({ message }) => message),
    ).toEqual([expect.stringContaining("--Ink → --surface → --Ink")]);
  });

  it("refuses a variable that aliases a target of another type", () => {
    const result = brand([
      { name: "Size", type: "FLOAT", values: { Light: "var(--Ink)" } },
      { name: "Mixed", values: { Light: "var(--Ink)", Dark: "var(--Gap-Small)" } },
    ]);

    expect(refused(result)).toEqual([
      { name: "Size", mode: "Light", message: expect.stringContaining("--Ink is a COLOR variable") },
      { name: "Mixed", mode: "Dark", message: expect.stringContaining("--Gap-Small is a FLOAT variable") },
    ]);
    expect(planned(result)).toEqual([]);
  });

  it("plans the first of two variables of one name in a collection and refuses the second", () => {
    const result = brand([
      { name: "Twin", values: { Light: "#FFF" } },
      { name: "Twin", values: { Light: "#000" } },
    ]);

    expect(result.created).toEqual([{ kind: "variable", name: "Twin", collection: "Brand Colors" }]);
    expect(refused(result)).toEqual([
      { name: "Twin", message: expect.stringContaining("Twin is listed twice in Brand Colors") },
    ]);
  });

  it("refuses a new variable whose values are all comments: nothing gives its type", () => {
    const result = brand([{ name: "Mystery", values: { Light: "/* var(--Gone) */" } }]);

    expect(refused(result)).toEqual([
      { name: "Mystery", message: expect.stringContaining("Mystery has no value that gives its type") },
    ]);
    expect(result.created).toEqual([]);
  });
});
