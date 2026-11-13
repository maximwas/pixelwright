import { describe, expect, it } from "vitest";
import { Assign } from "@/plugin/adapters/figma/assign.ts";
import { Capabilities, type TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { Variants } from "@/plugin/adapters/figma/components/variants.ts";
import type { ApplyCall } from "@/plugin/operations/apply/apply.types.ts";
import { ApplyLayers } from "@/plugin/operations/apply/apply-layers.ts";
import { ApplyChecks } from "@/plugin/operations/apply/checks.ts";
import { PropertyMarks } from "@/plugin/operations/apply/property-marks.ts";
import { PropertyStep } from "@/plugin/operations/apply/writers/property-step.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

// No Figma here (CLAUDE.md): layers are plain data that carry what the checks read (type, parent, a component's
// property definitions); the creator records what a real run would make. The live suite runs the same cases in Figma.
const page = { id: "0:1", type: "PAGE", name: "Page", parent: null };
const frame = { id: "1:1", type: "FRAME", name: "Frame", parent: page };
const instance = { id: "1:3", type: "INSTANCE", name: "Button", parent: page };
const slot = { id: "1:4", type: "SLOT", name: "Content", parent: instance };

function component(definitions: Record<string, { type: string }> = {}) {
  return { id: "1:2", type: "COMPONENT", name: "Card", parent: page, componentPropertyDefinitions: definitions };
}

function change(
  tag: string,
  ref: string,
  parent: string | null,
  props: object = {},
): ApplyChangeData {
  return {
    line: 1,
    column: 1,
    kind: "create",
    ref,
    id: null,
    tag,
    parent,
    index: 0,
    props,
    sources: {},
  } as ApplyChangeData;
}

function call(
  dry: boolean,
  held: Record<string, unknown>,
  changes: ApplyChangeData[],
): ApplyCall {
  return {
    dry,
    changes,
    top: page as never,
    layers: new Map(Object.entries(held) as [string, TypedLayer][]),
    failed: new Map(),
    counterparts: {} as never,
  };
}

function build() {
  const made: string[] = [];
  const checks = new ApplyChecks({} as never, {} as never, new Capabilities(), [
    new PropertyStep(new PropertyMarks(new Variants(), new Assign())),
  ]);
  const creator = {
    create: () => {
      made.push("layer");

      return {};
    },
  };
  const placement = { whereTo: async () => ({}) };

  return { made, layers: new ApplyLayers(checks, creator as never, placement as never, {} as never) };
}

describe("ApplyLayers: a new layer's place is refused before the layer is made, alike on dry and real runs", () => {
  const BOTH = [true, false];

  // m:f66aed65: a dry run works on stand-ins for the layers it would make, so it must walk the same way up.
  it.each(BOTH)("refuses a mark whose component has its name as another kind (dry %s)", async (dry) => {
    const { made, layers } = build();
    const text = change("Text", "t", "c", { property: { text: "Name" } });
    const held = { c: component({ "Name#1:2": { type: "BOOLEAN" } }) };

    await expect(layers.of(text, call(dry, held, [text]))).rejects.toThrow("another kind cannot take its name");
    expect(made).toEqual([]);
  });

  it("finds the component through the stand-in a dry run keeps for a layer above", async () => {
    const { layers } = build();
    const inner = change("Frame", "f", "c");
    const text = change("Text", "t", "f", { property: { text: "Name" } });
    const run = call(true, { c: component({ "Name#1:2": { type: "BOOLEAN" } }) }, [inner, text]);

    run.layers.set("f", await layers.of(inner, run));

    await expect(layers.of(text, run)).rejects.toThrow("another kind cannot take its name");
  });

  it.each(BOTH)("refuses a mark in a layer no component holds (dry %s)", async (dry) => {
    const { made, layers } = build();
    const text = change("Text", "t", "f", { property: { text: "Name" } });

    await expect(layers.of(text, call(dry, { f: frame }, [text]))).rejects.toThrow("No component holds this layer");
    expect(made).toEqual([]);
  });

  it("has nothing to clash with in a component the call makes", async () => {
    const { layers } = build();
    const made = change("Component", "c", null);
    const text = change("Text", "t", "c", { property: { text: "Name" } });
    const run = call(true, {}, [made, text]);

    run.layers.set("c", await layers.of(made, run));

    await expect(layers.of(text, run)).resolves.toMatchObject({ type: "TEXT" });
  });

  it.each(BOTH)("refuses a new layer in an instance outside its slots (dry %s)", async (dry) => {
    const { made, layers } = build();
    const inner = change("Frame", "f", "i");

    await expect(layers.of(inner, call(dry, { i: instance }, [inner]))).rejects.toThrow(
      "Layers go into an instance only through its slots.",
    );
    expect(made).toEqual([]);
  });

  it("takes a new layer in a slot of an instance", async () => {
    const { layers } = build();
    const inner = change("Frame", "f", "s");

    await expect(layers.of(inner, call(true, { s: slot }, [inner]))).resolves.toMatchObject({ type: "FRAME" });
  });

  it("refuses a new layer in the stand-in of an instance the call makes", async () => {
    const { layers } = build();
    const made = change("Instance", "i", null, { component: "Card" });
    const inner = change("Frame", "f", "i");
    const run = call(true, {}, [made, inner]);

    run.layers.set("i", await layers.of(made, run));

    await expect(layers.of(inner, run)).rejects.toThrow("Layers go into an instance only through its slots.");
  });

  it.each(BOTH)("refuses a ComponentSet with no Component in it (dry %s)", async (dry) => {
    const { made, layers } = build();
    const set = change("ComponentSet", "s", null);
    const inner = change("Frame", "f", "s");

    await expect(layers.of(set, call(dry, {}, [set, inner]))).rejects.toThrow(
      "A ComponentSet is made of the Components inside it",
    );
    expect(made).toEqual([]);
  });

  it("takes a ComponentSet with a Component in it", async () => {
    const { layers } = build();
    const set = change("ComponentSet", "s", null);
    const variant = change("Component", "v", "s");

    await expect(layers.of(set, call(true, {}, [set, variant]))).resolves.toMatchObject({ type: "COMPONENT_SET" });
  });
});
