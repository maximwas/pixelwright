import { describe, expect, it, vi } from "vitest";
import { Assign } from "@/plugin/adapters/figma/assign.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { Variants } from "@/plugin/adapters/figma/components/variants.ts";
import { PropertyMarks } from "@/plugin/operations/apply/property-marks.ts";
import { ApplyReport } from "@/plugin/operations/apply/report.ts";
import { PropertyStep } from "@/plugin/operations/apply/writers/property-step.ts";

// No Figma here (CLAUDE.md): a layer is plain data with its type and parent; a stand-in (a layer a dry run would make)
// has no id, and a component has the definitions the check reads.
const page = { id: "0:1", type: "PAGE", parent: null };

function component(definitions: Record<string, { type: string }>) {
  return { id: "1:2", type: "COMPONENT", name: "Card", parent: page, componentPropertyDefinitions: definitions };
}

function check(layer: object, property: object): void {
  new PropertyMarks(new Variants(), new Assign()).check(layer as TypedLayer, property);
}

describe("PropertyMarks.check", () => {
  it("refuses a name the component has as another kind, through the stand-in's parents", () => {
    const standIn = { type: "FRAME", parent: component({ "Name#1:2": { type: "BOOLEAN" } }) };

    expect(() => check({ type: "TEXT", parent: standIn }, { text: "Name" })).toThrow(
      "Card has a boolean property Name: another kind cannot take its name.",
    );
  });

  it("takes a name the component has as the same kind, and one it lacks", () => {
    const parent = component({ "Name#1:2": { type: "TEXT" } });

    expect(() => check({ type: "TEXT", parent }, { text: "Name" })).not.toThrow();
    expect(() => check({ type: "TEXT", parent }, { text: "Other" })).not.toThrow();
  });

  it("refuses a layer no component holds", () => {
    expect(() => check({ type: "TEXT", parent: { type: "FRAME", parent: page } }, { text: "Name" })).toThrow(
      "No component holds this layer",
    );
  });

  it("refuses a layer inside an instance", () => {
    expect(() =>
      check({ type: "TEXT", parent: { id: "1:3", type: "INSTANCE", parent: page } }, { text: "Name" }),
    ).toThrow("inside an instance");
  });

  it("has nothing to check against in a component the call makes", () => {
    expect(() => check({ type: "TEXT", parent: { type: "COMPONENT", parent: page } }, { text: "Name" })).not.toThrow();
  });

  it("refuses a text property on a layer that is no text", () => {
    expect(() => check({ type: "FRAME", parent: component({}) }, { text: "Name" })).toThrow("goes on a <Text>");
  });
});

// A dry run adds no property, so a call's second layer is checked against what its first asked (m:f66aed65): the step
// is the seam both runs go through, `place` before a layer is made and `check` after it.
describe("PropertyStep: one name asked as two kinds by the layers of a component the call makes", () => {
  const owner = { type: "COMPONENT", name: "x", parent: page };
  const text = { type: "TEXT", parent: owner } as TypedLayer;
  const frame = { type: "FRAME", parent: owner } as TypedLayer;
  const clash = "x has a text property Name: another kind cannot take its name.";

  function step(): PropertyStep {
    return new PropertyStep(new PropertyMarks(new Variants(), new Assign()));
  }

  it("refuses the second layer, before it is made and after, as a name the component has as another kind", () => {
    const marks = step();

    marks.check({ property: { text: "Name" } }, text);

    expect(() => marks.place({ property: { visible: "Name" } }, frame)).toThrow(clash);
    expect(() => marks.check({ property: { visible: "Name" } }, frame)).toThrow(clash);
  });

  it("takes a name asked again as the same kind, and another name", () => {
    const marks = step();

    marks.check({ property: { text: "Name" } }, text);

    expect(() => marks.check({ property: { text: "Name" } }, text)).not.toThrow();
    expect(() => marks.check({ property: { visible: "Other" } }, frame)).not.toThrow();
  });

  it("leaves a prop and a visibleProp of one name on one layer as they were", () => {
    const marks = step();
    const both = { property: { text: "Name", visible: "Name" } };

    expect(() => marks.place(both, text)).not.toThrow();
    expect(() => marks.check(both, text)).not.toThrow();
  });

  it("asks nothing of a name another component of the call took", () => {
    const marks = step();
    const other = { type: "FRAME", parent: { type: "COMPONENT", name: "y", parent: page } } as TypedLayer;

    marks.check({ property: { text: "Name" } }, text);

    expect(() => marks.check({ property: { visible: "Name" } }, other)).not.toThrow();
  });

  it("holds the variants of a set the call makes to one owner, the set", () => {
    const marks = step();
    const set = { type: "COMPONENT_SET", name: "s", parent: page };
    const first = { type: "TEXT", parent: { type: "COMPONENT", name: "a", parent: set } } as TypedLayer;
    const second = { type: "FRAME", parent: { type: "COMPONENT", name: "b", parent: set } } as TypedLayer;

    marks.check({ property: { text: "Name" } }, first);

    expect(() => marks.check({ property: { visible: "Name" } }, second)).toThrow(
      "s has a text property Name: another kind cannot take its name.",
    );
  });
});

// T-129: the answer's properties are those added to components there before the call; a dry run's, those it would add.
describe("PropertyMarks.added", () => {
  function existing(definitions: Record<string, { type: string }>) {
    return { ...component(definitions), addComponentProperty: vi.fn((name: string) => `${name}#9:9`) };
  }

  it("lists on a dry run the names an existing component lacks, once, and not those it has", () => {
    const marks = new PropertyMarks(new Variants(), new Assign());
    const parent = existing({ "Title#1:2": { type: "TEXT" } });

    marks.start(true);

    for (const property of [{ text: "Title" }, { text: "Price" }, { text: "Price" }]) {
      marks.check({ type: "TEXT", parent } as TypedLayer, property);
      marks.claim({ type: "TEXT", parent } as TypedLayer, property);
    }

    marks.claim({ type: "TEXT", parent: { type: "COMPONENT", name: "New", parent: page } } as TypedLayer, {
      text: "Label",
    });

    expect(marks.added()).toEqual([{ component: "1:2", name: "Price", type: "TEXT" }]);
  });

  it("lists on a real run what binding added, and nothing for a name the component had", async () => {
    const marks = new PropertyMarks(new Variants(), new Assign());
    const parent = existing({ "Shown#1:2": { type: "BOOLEAN" } });
    const layer = (id: string) => ({
      id,
      type: "TEXT",
      parent,
      visible: true,
      characters: "",
      componentPropertyReferences: {},
    });

    marks.start(false);
    marks.claim(layer("1:5") as TypedLayer, { text: "Price" });
    marks.add(layer("1:5") as never, { text: "Price" });
    marks.add(layer("1:6") as never, { visible: "Shown" });
    await marks.bind(new Set());

    expect(marks.added()).toEqual([{ component: "1:2", name: "Price", type: "TEXT" }]);
  });

  it("leaves out of the answer the properties of a component the call made", () => {
    const report = new ApplyReport();

    report.made({ line: 1, ref: "new:1", tag: "Component" } as never, { id: "5:5", name: "Card" });

    expect(
      report.result([
        { component: "5:5", name: "Title", type: "TEXT" },
        { component: "1:2", name: "Price", type: "TEXT" },
      ]).properties,
    ).toEqual([{ component: "1:2", name: "Price", type: "TEXT" }]);
    expect(report.result([]).properties).toBeUndefined();
  });
});
