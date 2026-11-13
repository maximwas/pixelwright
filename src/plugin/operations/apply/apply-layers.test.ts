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

/** An existing layer the XML puts in another parent. */
function moving(
  tag: string,
  ref: string,
  id: string,
  parent: string,
): ApplyChangeData {
  return { ...change(tag, ref, parent), kind: "update", id, moves: true } as ApplyChangeData;
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
    origins: {} as never,
  };
}

function build(lookup: unknown = {}) {
  const made: string[] = [];
  const moved: string[] = [];
  const step = new PropertyStep(new PropertyMarks(new Variants(), new Assign()));
  const checks = new ApplyChecks(lookup as never, {} as never, new Capabilities(), [step]);
  const creator = {
    create: () => {
      made.push("layer");

      return {};
    },
  };
  const placement = {
    whereTo: async () => ({}),
    move: async () => {
      moved.push("move");
    },
  };

  return { made, moved, step, layers: new ApplyLayers(checks, creator as never, placement as never, {} as never) };
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

  // The first layer's checks run once it is made, as the writer's do; the second is asked its place before it is made.
  it("refuses a second mark of one name as another kind in a component a dry run makes, before the layer", async () => {
    const { made, layers, step } = build();
    const owner = change("Component", "c", null, { name: "x" });
    const first = change("Text", "t", "c", { property: { text: "Name" } });
    const second = change("Frame", "f", "c", { property: { visible: "Name" } });
    const run = call(true, {}, [owner, first, second]);

    run.layers.set("c", await layers.of(owner, run));
    run.layers.set("t", await layers.of(first, run));
    step.check(first.props, run.layers.get("t") as TypedLayer);

    await expect(layers.of(second, run)).rejects.toThrow(
      "x has a text property Name: another kind cannot take its name.",
    );
    expect(made).toEqual([]);
  });

  it("refuses it on a real run too, and makes only the first", async () => {
    const { made, layers, step } = build();
    const owner = { ...component(), name: "x" };
    const first = change("Text", "t", "c", { property: { text: "Name" } });
    const second = change("Frame", "f", "c", { property: { visible: "Name" } });
    const run = call(false, { c: owner }, [first, second]);

    await layers.of(first, run);
    step.check(first.props, { type: "TEXT", parent: owner as TypedLayer });

    await expect(layers.of(second, run)).rejects.toThrow(
      "x has a text property Name: another kind cannot take its name.",
    );
    expect(made).toEqual(["layer"]);
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

// m:f66aed65: a real run holds a new set's variants in a plain frame until they combine, which then goes: a layer that
// is no Component would go with it, so the set's own element refuses it, a moved layer by its real type.
describe("ApplyLayers: a ComponentSet holds Components only, refused before any write alike on dry and real runs", () => {
  const BOTH = [true, false];
  const SET = "A ComponentSet holds only Components: <Frame> is not one.";
  const holder = { id: "2:1", type: "FRAME", name: "Set", parent: page };
  const component = { id: "1:9", type: "COMPONENT", name: "Card", parent: page };
  const held = (dry: boolean) => ({ s: dry ? { type: "COMPONENT_SET", parent: page } : holder });
  const set = change("ComponentSet", "s", null);
  const variant = change("Component", "v", "s");
  const found = (layer: unknown) => ({ node: async () => layer, pageOf: () => null });

  it.each(BOTH)("refuses an existing Frame moved into a new ComponentSet (dry %s)", async (dry) => {
    const { moved, layers } = build(found(frame));
    const inner = moving("Frame", "f", frame.id, "s");

    await expect(layers.of(inner, call(dry, held(dry), [set, variant, inner]))).rejects.toThrow(SET);
    await expect(layers.of(inner, call(dry, held(dry), [set, variant, inner]))).rejects.toMatchObject({
      hint: "Move it out of the set, or make it a Component.",
    });
    expect(moved).toEqual([]);
  });

  it.each(BOTH)("refuses a new Frame in a ComponentSet (dry %s)", async (dry) => {
    const { made, layers } = build();
    const inner = change("Frame", "f", "s");

    await expect(layers.of(inner, call(dry, held(dry), [set, variant, inner]))).rejects.toThrow(SET);
    expect(made).toEqual([]);
  });

  it.each(BOTH)("moves an existing Component into a new ComponentSet (dry %s)", async (dry) => {
    const { moved, layers } = build(found(component));
    const inner = moving("Component", "c", component.id, "s");

    await layers.of(inner, call(dry, held(dry), [set, inner]));

    expect(moved).toEqual(["move"]);
  });
});
