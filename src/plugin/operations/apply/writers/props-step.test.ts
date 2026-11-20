import { describe, expect, it } from "vitest";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { ComponentIndex } from "@/plugin/adapters/figma/components/component-index.ts";
import { Variants } from "@/plugin/adapters/figma/components/variants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { PropsStep } from "@/plugin/operations/apply/writers/props-step.ts";

// No Figma here (CLAUDE.md): the component a dry run finds by name is plain data with its property definitions, as Figma
// keys them (a #id after the name, none on a variant property); the new instance is a stand-in with a type alone.
const CARD = {
  name: "Plan Card",
  type: "COMPONENT_SET",
  defaultVariant: { id: "1:9" },
  componentPropertyDefinitions: {
    "Name#1:1": { type: "TEXT" },
    "Popular#1:2": { type: "BOOLEAN" },
    "Icon#1:3": { type: "INSTANCE_SWAP" },
    Size: { type: "VARIANT" },
  },
};
const NEW_INSTANCE: TypedLayer = { type: "INSTANCE" };

function step(finds: string[] = []): PropsStep {
  const components = Object.assign(new ComponentIndex(new Variants()), {
    find: async (name: string) => {
      finds.push(name);

      if (name === "Gone") {
        throw new WriteError(
          "No component or component set is named Gone in this file or the libraries its page uses.",
        );
      }

      return CARD;
    },
  });

  return new PropsStep(components, {} as never);
}

describe("PropsStep.check on a new instance, found by name without writing", () => {
  it("refuses a name its component lacks, with the names it has and the nearest one", async () => {
    await expect(step().check({ component: "Plan Card", props: { Nmae: "Live" } }, NEW_INSTANCE)).rejects.toMatchObject(
      { message: "Plan Card has no property Nmae: it has Name, Popular, Icon, Size.", hint: "Did you mean Name?" },
    );
  });

  it("refuses a value of a true or false property that is neither", async () => {
    await expect(step().check({ component: "Plan Card", props: { Popular: "maybe" } }, NEW_INSTANCE)).rejects.toThrow(
      "Popular is a true or false property: maybe is neither.",
    );
  });

  it("refuses an instance swap that names no component", async () => {
    await expect(step().check({ component: "Plan Card", props: { Icon: "Gone" } }, NEW_INSTANCE)).rejects.toThrow(
      "No component or component set is named Gone",
    );
  });

  it("takes names and values its component has", async () => {
    const finds: string[] = [];
    const props = { Name: "Live", Popular: "true", Icon: "Button" };

    await expect(step(finds).check({ component: "Plan Card", props }, NEW_INSTANCE)).resolves.toBeUndefined();
    expect(finds).toEqual(["Plan Card", "Button"]);
  });

  // The variant step refuses the same component; the props are not refused for it a second time.
  it("leaves a component that is not found to the variant step", async () => {
    await expect(step().check({ component: "Gone", props: { Name: "Live" } }, NEW_INSTANCE)).resolves.toBeUndefined();
  });

  // Importing by key writes to the file and a dry run makes nothing: those names are left to the write.
  it("leaves a component by key and a swap by key to the write", async () => {
    const finds: string[] = [];

    await step(finds).check({ component: "key:abc", props: { Nmae: "Live" } }, NEW_INSTANCE);
    await step(finds).check({ component: "Plan Card", props: { Icon: "key:abc" } }, NEW_INSTANCE);

    expect(finds).toEqual(["Plan Card"]);
  });
});

describe("PropsStep.check on an instance that exists", () => {
  it("checks the names and values against the properties the instance has", async () => {
    const instance = {
      type: "INSTANCE",
      name: "Card copy",
      componentProperties: { "Name#1:1": { type: "TEXT" }, "Popular#1:2": { type: "BOOLEAN" } },
    } as never;

    await expect(step().check({ props: { Nmae: "Live" } }, instance)).rejects.toMatchObject({
      message: "Card copy has no property Nmae: it has Name, Popular.",
    });
    await expect(step().check({ props: { Popular: "yes" } }, instance)).rejects.toThrow("Popular is a true or false");
  });
});
