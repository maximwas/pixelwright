import { describe, expect, it } from "vitest";
import { Assign } from "@/plugin/adapters/figma/assign.ts";
import { DescriptionStep } from "@/plugin/operations/apply/writers/description-step.ts";

// 0.7.0's annotation steps: a component's and a set's description is written; any other layer has none.
describe("DescriptionStep", () => {
  const step = new DescriptionStep(new Assign());

  it("takes a description on a component or a component set, and refuses it on any other layer", () => {
    expect(() => step.check({ description: "A card." }, { type: "COMPONENT" })).not.toThrow();
    expect(() => step.check({ description: "Cards." }, { type: "COMPONENT_SET" })).not.toThrow();
    expect(() => step.check({ description: "A card." }, { type: "FRAME" })).toThrow(
      "A description belongs to a component or a component set.",
    );
  });

  it("writes the description where it differs", () => {
    const component = { type: "COMPONENT", description: "" };

    step.write(component as never, { description: "A card." });

    expect(component.description).toBe("A card.");
  });
});
