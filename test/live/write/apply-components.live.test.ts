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
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
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
    const left = async (name: string): Promise<number> =>
      (await run(`const section = await pw.node(${JSON.stringify(scratch)});
return section.findAll((node) => node.name === ${JSON.stringify(name)}).length;`)) as number;
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

  // T-127, m:f66aed65: a new instance's props are checked in a dry run against its component found by name: a name it
  // lacks, a boolean that is neither true nor false. The real run says the same.
  it("refuses a new instance's wrong props in a dry run as the real run does", async () => {
    for (const [index, props] of ["Nmae=Live", "Popular=maybe"].entries()) {
      const xml = `<Instance name="${PREFIX}props-${index}" component="Plan Card" props="${props}"/>`;
      const dry = await apply(xml, true);
      const real = await apply(xml);

      expect(dry.errors).toMatchObject([{ attribute: "props" }]);
      expect(real.errors).toEqual(dry.errors);
    }
  });
});
