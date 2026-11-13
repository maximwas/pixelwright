import { describe, expect, it } from "vitest";
import { Assign } from "@/plugin/adapters/figma/assign.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { Variants } from "@/plugin/adapters/figma/components/variants.ts";
import { PropertyMarks } from "@/plugin/operations/apply/property-marks.ts";

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
