import { describe, expect, it } from "vitest";
import {
  type ApplyChange,
  changeOf,
  type FigmaProps,
  PlannedComponents,
  placementSpan,
  readApply,
  tokenUsesOf,
} from "../src/index.ts";

describe("placementSpan", () => {
  it("places a layer from each kind of constraint in a parent 300 long", () => {
    expect(
      [
        {
          kind: "MIN",
          offset: 10,
        },
        {
          kind: "MAX",
          offset: 10,
        },
        {
          kind: "CENTER",
          offset: -20,
        },
        {
          kind: "STRETCH",
          start: 16,
          end: 24,
        },
        {
          kind: "SCALE",
          start: 10,
          size: 50,
        },
      ].map((spec) => placementSpan(spec as Parameters<typeof placementSpan>[0], 300, 40)),
    ).toEqual([
      {
        start: 10,
        size: 40,
      },
      {
        start: 250,
        size: 40,
      },
      {
        start: 130,
        size: 40,
      },
      {
        start: 16,
        size: 260,
      },
      {
        start: 30,
        size: 150,
      },
    ]);
  });
});

describe("tokenUsesOf", () => {
  it("lists every token in the order a dry run checks them: lengths, paints, then effect and text styles", () => {
    const props: FigmaProps = {
      textStyle: "Body",
      effects: { token: "--Shadow" },
      fills: [
        {
          kind: "token",
          token: "--Brand",
          opacity: 1,
        },
      ],
      padding: [{ token: "--space-8" }, 4, { token: "--space-8" }, 4],
      itemSpacing: { token: "--gap" },
      cornerRadius: [{ token: "--radius" }, 0, 0, 0],
    };

    expect(tokenUsesOf(props).map(({ key, token, kind }) => `${key} ${token} ${kind}`)).toEqual([
      "itemSpacing --gap FLOAT",
      "padding --space-8 FLOAT",
      "padding --space-8 FLOAT",
      "cornerRadius --radius FLOAT",
      "fills --Brand PAINT",
      "effects --Shadow EFFECT_STYLE",
      "textStyle Body TEXT_STYLE",
    ]);
  });
});

describe("PlannedComponents", () => {
  function planned(xml: string) {
    const changes = readApply(xml).elements.map((element) => changeOf(element).change);
    const byRef = new Map<string, ApplyChange>(changes.map((change) => [change.ref, change]));
    const components = new PlannedComponents();

    for (const change of changes) {
      components.record(change, byRef);
    }

    return components;
  }

  it("knows a set the XML makes with its variants, and says which one an instance cannot have", () => {
    const tag = planned(
      '<ComponentSet name="Tag"><Component variant="Tone=Dark"/><Component variant="Tone=Light"/></ComponentSet>',
    );

    expect([tag.has("Tag"), tag.has("Chip")]).toEqual([true, false]);
    expect(tag.missingVariant("Tag", { Tone: "Light" })).toBeNull();
    expect(tag.missingVariant("Tag", { Tone: "Blue" })).toBe(
      "Tag has no variant Tone=Blue: it has Tone=Dark; Tone=Light.",
    );
  });

  it("takes the values an instance leaves out from the set's first variant", () => {
    const pill = planned(
      '<ComponentSet name="Pill"><Component variant="Tone=Dark, Size=S"/><Component variant="Tone=Light, Size=L"/></ComponentSet>',
    );

    expect(pill.missingVariant("Pill", { Tone: "Dark" })).toBeNull();
    expect(pill.missingVariant("Pill", { Tone: "Light" })).toBe(
      "Pill has no variant Tone=Light: it has Tone=Dark, Size=S; Tone=Light, Size=L.",
    );
  });

  it("lets an instance of a lone component, a copied set or one the XML does not make have any variant", () => {
    const made = planned('<Component name="Chip"/>\n<ComponentSet name="Copy" copyOf="1:1"/>');

    expect(["Chip", "Copy", "Elsewhere"].map((name) => made.missingVariant(name, { Tone: "Blue" }))).toEqual([
      null,
      null,
      null,
    ]);
  });
});
