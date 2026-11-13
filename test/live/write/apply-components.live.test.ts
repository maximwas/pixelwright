import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

const PREFIX = "live:apply-components:";

type Applied = {
  created: { id?: string; tag: string }[];
  changed: string[];
  errors: { id?: string; attribute?: string; message: string; hint?: string }[];
};

// design_apply's components (item 44): instances of Orbit's components (instanced only, never edited), new
// components, variant sets and slots, made in the Live tests Section, each named live:apply-components:<case> and
// removed after.
describe("write/design_apply components, instances, variant sets and slots", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const apply = async (xml: string, dryRun = false): Promise<Applied> =>
    (await client.call("design_apply", { file, xml, parent: scratch, dryRun })) as Applied;
  /** The id of the layer the call made with this tag. */
  const made = (applied: Applied, tag: string): string => applied.created.find((one) => one.tag === tag)?.id ?? "";
  /** An instance's component (a variant's set by its name), its variant values and its other properties by name. */
  const instanceOf = async (id: string): Promise<unknown> =>
    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
const main = await node.getMainComponentAsync();
const owner = main.parent.type === "COMPONENT_SET" ? main.parent : main;
const props = Object.entries(node.componentProperties).filter(([, { type }]) => type !== "VARIANT");
return { component: owner.name, variant: main.variantProperties, props: Object.fromEntries(props.map(([key, { value }]) => [key.replace(/#[^#]*$/, ""), value])) };`);
  /** How many layers of the scratch section have this name. */
  const left = async (name: string): Promise<number> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
return section.findAll((node) => node.name === ${JSON.stringify(name)}).length;`)) as number;
  /** A layer's parent and its index there, or null once it is gone. */
  const where = async (id: string): Promise<unknown> =>
    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return node === null || node.removed ? null : [node.parent.id, node.parent.children.indexOf(node)];`);
  /** The first layer of this type inside a layer: its id. */
  const inside = async (id: string, type: string): Promise<string> =>
    (await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return node.findOne((layer) => layer.type === ${JSON.stringify(type)}).id;`)) as string;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    if (client === undefined) {
      return;
    }

    try {
      await run(`const section = await pw.node(${JSON.stringify(scratch)});
// A layer inside an instance (id I…) cannot be removed on its own and would stop the loop: its instance takes it.
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}) && !node.id.startsWith("I"))) {
  if (!node.removed) node.remove();
}`);
    } finally {
      await client.close();
    }
  });

  // T-127, P-083, P-084: an instance by its component's name, a set's variant merged over its default, props by the
  // names design_read writes. O-013: Figma takes the TEXT property (its text's fonts are loaded first, as in 0.7.0).
  it("makes instances by component name with a variant and props", async () => {
    const applied = await apply(
      `<Instance name="${PREFIX}plan" component="Plan Card" props="Name=Live, Popular=true"/>
<Instance name="${PREFIX}button" component="Button" variant="Variant=Secondary" props="Label=Go"/>`,
    );

    expect(applied.errors).toEqual([]);
    expect(applied.created).toHaveLength(2);
    expect(await instanceOf(applied.created[0]?.id ?? "")).toMatchObject({
      component: "Plan Card",
      props: { Name: "Live", Popular: true },
    });
    expect(await instanceOf(applied.created[1]?.id ?? "")).toMatchObject({
      component: "Button",
      variant: { Variant: "Secondary", State: "Default" },
      props: { Label: "Go" },
    });
  });

  // T-128, B-029, FX-022: Figma re-ids a switched instance's layers, so the edit inside it by the old id is refused on
  // the dry and the real run alike; the switch itself is written.
  it("switches a variant and refuses the edit inside the switched instance", async () => {
    const button = made(await apply(`<Instance name="${PREFIX}switch" component="Button"/>`), "Instance");
    const label = await inside(button, "TEXT");
    const xml = `<Instance id="${button}" variant="Variant=Secondary"><Text id="${label}" opacity="0.5"/></Instance>`;
    const refused = {
      id: label,
      message: `This layer is inside ${button}, which this call switches to another variant: Figma gives the instance's layers new ids then, so this layer is not written.`,
      hint: "Switch the variant first, read the instance again, then edit its layers by their new ids.",
    };

    expect((await apply(xml, true)).errors).toMatchObject([refused]);

    const applied = await apply(xml);

    expect(applied.errors).toMatchObject([refused]);
    expect(applied.changed).toEqual([button]);
    expect(await instanceOf(button)).toMatchObject({ variant: { Variant: "Secondary" } });
  });

  // T-129, P-146, FX-026: prop, visibleProp and swapProp make a new component's properties, each bound to its layer;
  // a key carries Figma's #id, a swap's default is the instance's component id, a shown layer's boolean is true.
  it("makes a new component's text, boolean and instance swap properties", async () => {
    const applied = await apply(
      `<Component name="${PREFIX}props"><Text prop="Label">Hi</Text><Frame visibleProp="Shown" width="10px" height="10px"/><Instance component="Button" swapProp="Action"/></Component>`,
    );

    expect(applied.errors).toEqual([]);
    expect(
      await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(made(applied, "Component"))});
const main = await node.findOne((layer) => layer.type === "INSTANCE").getMainComponentAsync();
const definitions = Object.entries(node.componentPropertyDefinitions);
return {
  definitions: definitions.map(([key, { type, defaultValue }]) => [key.replace(/#[^#]*$/, ""), type, defaultValue === main.id ? "its component" : defaultValue]).sort(),
  keyed: definitions.every(([key]) => /#\\d+:\\d+$/.test(key)),
  bound: node.findAll((layer) => !layer.id.startsWith("I")).flatMap((layer) => Object.keys(layer.componentPropertyReferences ?? {})).sort(),
};`),
    ).toEqual({
      definitions: [
        ["Action", "INSTANCE_SWAP", "its component"],
        ["Label", "TEXT", "Hi"],
        ["Shown", "BOOLEAN", true],
      ],
      keyed: true,
      bound: ["characters", "mainComponent", "visible"],
    });
  });

  // T-129, m:bc6811ca: a new set's variants combined into one set and, with no layout of its own, laid out as a grid:
  // a column per value of its first variant property, a row per the rest, 40 px around and between them.
  it("lays a new set of three variants out as a grid", async () => {
    const variant = (values: string) => `<Component variant="${values}" width="40px" height="20px"/>`;
    const applied = await apply(
      `<ComponentSet name="${PREFIX}set">${variant("Tone=Dark, Size=S")}${variant("Tone=Light, Size=S")}${variant("Tone=Dark, Size=L")}</ComponentSet>`,
    );

    expect(applied.errors).toEqual([]);
    expect(
      await run(`const set = await figma.getNodeByIdAsync(${JSON.stringify(made(applied, "ComponentSet"))});
return { type: set.type, name: set.name, size: [set.width, set.height], cells: set.children.map((variant) => [variant.x, variant.y]).sort() };`),
    ).toEqual({
      type: "COMPONENT_SET",
      name: `${PREFIX}set`,
      size: [200, 160],
      cells: [
        [120, 40],
        [40, 100],
        [40, 40],
      ].sort(),
    });
  });

  // T-130, O-013, m:27712fda: <Slot name> makes a slot in a new component, which Figma gives a SLOT property; an
  // instance's slot then takes new layers.
  it("makes a slot in a new component and puts new layers in an instance's slot", async () => {
    const component = await apply(`<Component name="${PREFIX}slotted"><Slot name="Content"/></Component>`);

    expect(component.errors).toEqual([]);
    expect(
      await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(made(component, "Component"))});
return Object.values(node.componentPropertyDefinitions).map(({ type }) => type);`),
    ).toContain("SLOT");

    const instance = made(
      await apply(`<Instance name="${PREFIX}slotted-instance" component="${PREFIX}slotted"/>`),
      "Instance",
    );
    const slot = await inside(instance, "SLOT");
    const filled = await apply(
      `<Instance id="${instance}"><Slot id="${slot}"><Frame name="${PREFIX}in-slot" width="20px" height="20px"/></Slot></Instance>`,
    );

    expect(filled.errors).toEqual([]);
    expect(
      await run(`const slot = await figma.getNodeByIdAsync(${JSON.stringify(slot)});
return slot.children.map((child) => child.name);`),
    ).toContain(`${PREFIX}in-slot`);
  });

  // P-149, FX-021: a layer inside an instance is hidden last, as hidden it can drop out of the plugin API at once, so
  // what the call sets on it before goes in too.
  it("hides a layer inside an instance last, after what else the call sets on it", async () => {
    const button = made(await apply(`<Instance name="${PREFIX}hidden" component="Button"/>`), "Instance");
    const label = await inside(button, "TEXT");
    const applied = await apply(
      `<Instance id="${button}"><Text id="${label}" opacity="0.5" display="none"/></Instance>`,
    );

    expect(applied.errors).toEqual([]);
    expect(
      await run(`figma.skipInvisibleInstanceChildren = false;
const node = await figma.getNodeByIdAsync(${JSON.stringify(label)});
return [node.opacity, node.visible];`),
    ).toEqual([0.5, false]);
  });

  // T-129, m:f66aed65: a mark that cannot bind is refused before its layer is made, on the dry and the real run alike:
  // a component's property of another kind by the name, a layer no component holds. The real run leaves no layer.
  it("refuses a property mark that cannot bind before it makes its layer, on both runs", async () => {
    const component = made(
      await apply(
        `<Component name="${PREFIX}marks"><Frame visibleProp="Name" width="10px" height="10px"/></Component>`,
      ),
      "Component",
    );
    const frame = made(await apply(`<Frame name="${PREFIX}plain" width="40px" height="40px"/>`), "Frame");
    const cases = [
      {
        xml: `<Component id="${component}"><Text name="${PREFIX}clash" prop="Name">x</Text></Component>`,
        message: `${PREFIX}marks has a boolean property Name: another kind cannot take its name.`,
        name: `${PREFIX}clash`,
      },
      {
        // Under an existing plain frame, so core lets the mark through and the plugin finds no component holding it.
        xml: `<Frame id="${frame}"><Text name="${PREFIX}unheld" prop="Name">x</Text></Frame>`,
        message:
          "No component holds this layer: prop, visibleProp and swapProp bind a component's layers to its properties.",
        name: `${PREFIX}unheld`,
      },
    ];

    for (const { xml, message, name } of cases) {
      const dry = await apply(xml, true);
      const real = await apply(xml);

      expect(dry.errors).toMatchObject([{ message }]);
      expect(real.errors).toMatchObject([{ message }]);
      expect(await left(name)).toBe(0);
    }
  });

  // T-129, m:f66aed65: two marks of one name as two kinds in one new component are refused alike by the dry and the real
  // run, the second before its layer is made: the real run's component keeps the one property the first made.
  it("refuses a second mark of one name as another kind in a new component before it makes the layer, on both runs", async () => {
    const name = `${PREFIX}twice`;
    const xml = `<Component name="${name}"><Text name="${PREFIX}twice-text" prop="Name">a</Text><Frame name="${PREFIX}twice-frame" visibleProp="Name" width="10px" height="10px"/></Component>`;
    const message = `${name} has a text property Name: another kind cannot take its name.`;
    const dry = await apply(xml, true);

    expect(dry.errors).toMatchObject([{ message }]);
    expect(await left(name)).toBe(0);

    const real = await apply(xml);

    expect(real.errors).toMatchObject([{ message }]);
    expect(await left(`${PREFIX}twice-frame`)).toBe(0);
    expect(
      await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(made(real, "Component"))});
return Object.values(node.componentPropertyDefinitions).map(({ type }) => type);`),
    ).toEqual(["TEXT"]);
  });

  // m:f66aed65: a mark that fails only once its set is whole (two variants asking one name as two kinds: a real run
  // cannot tell a variant's frame from any other before the set is combined) takes its layer away; a layer that was
  // there before the call, moved into that layer, goes back where it stood and is never taken with it.
  it("puts an existing layer back where it stood when the layer it was moved into is taken away", async () => {
    const keep = made(await apply(`<Frame name="${PREFIX}keep" width="40px" height="40px"/>`), "Frame");
    const stood = await where(keep);
    const name = `${PREFIX}moved-set`;
    const xml = `<ComponentSet name="${name}"><Component variant="Size=S" width="40px" height="20px"><Text prop="Name">a</Text></Component><Component variant="Size=L" width="40px" height="20px"><Frame name="${PREFIX}moved-bound" visibleProp="Name" width="30px" height="30px"><Frame id="${keep}"/></Frame></Component></ComponentSet>`;
    const message = `${name} has a text property Name: another kind cannot take its name.`;

    // A dry run refuses the layers inside the refused frame too (their parent was not made): the clash is among them.
    const told = expect.arrayContaining([expect.objectContaining({ message })]);

    expect((await apply(xml, true)).errors).toEqual(told);
    expect(await where(keep)).toEqual(stood);

    const real = await apply(xml);

    expect(real.errors).toEqual(told);
    expect(await where(keep)).toEqual(stood);
    expect(await left(`${PREFIX}moved-bound`)).toBe(0);
  });

  // m:f66aed65: a real run holds a new set's variants in a plain frame until they combine, and the frame goes: a layer
  // that is no Component would go with it, so a ComponentSet's element refuses any other layer, a new one or an
  // existing one moved into it, alike on the dry and the real run, before it moves; the frame stays where it stood.
  it("refuses a layer that is no Component in a new ComponentSet on both runs and leaves an existing one where it stood", async () => {
    const keep = made(await apply(`<Frame name="${PREFIX}set-keep" width="40px" height="40px"/>`), "Frame");
    const stood = await where(keep);
    const variant = `<Component variant="Size=S" width="40px" height="20px"/>`;
    const message = "A ComponentSet holds only Components: <Frame> is not one.";
    const cases = [
      { name: `${PREFIX}set-moved`, inside: `<Frame id="${keep}"/>` },
      { name: `${PREFIX}set-new`, inside: `<Frame name="${PREFIX}set-new-frame" width="10px" height="10px"/>` },
    ];

    for (const { name, inside } of cases) {
      const xml = `<ComponentSet name="${name}">${variant}${inside}</ComponentSet>`;

      expect((await apply(xml, true)).errors).toMatchObject([{ message }]);
      expect(await where(keep)).toEqual(stood);
      expect((await apply(xml)).errors).toMatchObject([{ message }]);
      expect(await where(keep)).toEqual(stood);
      expect(await left(`${PREFIX}set-new-frame`)).toBe(0);
    }
  });

  // T-127, m:f66aed65: a new instance's props are checked in a dry run against its component found by name: a name it
  // lacks, a boolean that is neither true nor false. The real run says the same.
  it("refuses a new instance's wrong props in a dry run as the real run does", async () => {
    for (const [index, props] of ["Nmae=Live", "Popular=maybe"].entries()) {
      const name = `${PREFIX}props-${index}`;
      const xml = `<Instance name="${name}" component="Plan Card" props="${props}"/>`;
      const dry = await apply(xml, true);

      expect(dry.errors).toMatchObject([{ attribute: "props" }]);
      expect(await left(name)).toBe(0);

      const real = await apply(xml);

      expect(real.errors).toEqual(dry.errors);
      // Only its props are refused (the error names the attribute): the instance is made with its component's own
      // values, so the real run leaves it where the dry run left nothing.
      expect(await left(name)).toBe(1);
    }
  });
});
