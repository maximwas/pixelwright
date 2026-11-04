import { copyFile, mkdtemp } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { LiveClient, type ToolResult } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { orbitComponents, pricingDesktop } = TEST_MCP.ids;

/** Callout's instance on Pricing – Desktop: its component (81:1514) has a SLOT property, Actions, holding two Buttons. */
const CALLOUT = "81:1522";

/** Button's Variant=Primary, State=Default: the component the made layer exposes an instance of. */
const BUTTON_PRIMARY = "54:189";

/** The prefix of the layers this file makes in the Live tests Section, removed after. */
const PREFIX = "live:components:";

interface Listed {
  readonly name: string;
  readonly type: string;
  readonly remote: boolean;
  readonly variants?: { id: string; name: string }[];
  readonly properties: Record<string, { type: string; default?: string | boolean; options?: string[] }>;
  readonly instances?: number;
  readonly exposed?: { name: string; component: string; key: string; properties: object }[];
  readonly links?: { name: string; url: string }[];
  readonly error?: string;
}

interface Components extends ToolResult {
  readonly components: Listed[];
  readonly more: boolean;
  readonly notes?: string[];
}

interface Libraries extends ToolResult {
  readonly components?: { library: string; component: string; name: string }[];
  readonly saved?: { library: string; path: string; components: number };
  readonly libraries: { name: string; path: string }[];
}

// Reads, but for one component made in the Live tests Section (live:components:<case>, removed after), since no
// layer of Test MCP exposes an instance. library_search writes its catalogue into a temp home, never the channel's: that server shares the
// channel's bridge.json, so it reaches Test MCP's plugin as the others do.
describe("read/components", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
    await client.close();
  });

  const read = async (args: Record<string, unknown>): Promise<Components> =>
    (await client.call("components_read", { file, ...args })) as Components;

  it("lists Orbit's components with their properties read from the set, Button's variants among them (T-190, FX-028)", async () => {
    const { components } = await read({ scope: "local", within: orbitComponents });
    const card = components.find(({ name }) => name === "Plan Card");
    const button = components.find(({ name }) => name === "Button");

    expect(card).toMatchObject({ type: "COMPONENT", remote: false });
    expect(card?.error).toBeUndefined();
    expect(Object.values(card?.properties ?? {}).map(({ type }) => type)).toContain("TEXT");
    expect(Object.keys(card?.properties ?? {}).some((name) => name.includes("#"))).toBe(false);
    expect(button).toMatchObject({ type: "COMPONENT_SET" });
    expect(button?.error).toBeUndefined();
    expect(button?.variants?.length).toBeGreaterThan(1);
    expect(
      Object.values(button?.properties ?? {}).some(
        ({ type, options }) => type === "VARIANT" && (options?.length ?? 0) > 1,
      ),
    ).toBe(true);
  });

  it("lists Callout's SLOT property without a default, read through its instance (B-060)", async () => {
    const { components } = await read({ scope: "used", within: CALLOUT });
    const callout = components.find(({ name }) => name === "Callout");
    const slot = Object.values(callout?.properties ?? {}).find(({ type }) => type === "SLOT");

    expect(callout).toMatchObject({ type: "COMPONENT", instances: 1 });
    expect(slot).toBeDefined();
    expect(slot).not.toHaveProperty("default");
  });

  it("lists the Button a component exposes (T-190)", async () => {
    const made = await run(`const section = await pw.node(${JSON.stringify(scratch)});
const button = await pw.node(${JSON.stringify(BUTTON_PRIMARY)});
const component = figma.createComponent();
component.name = ${JSON.stringify(`${PREFIX}exposed`)};
section.appendChild(component);
const inner = button.createInstance();
component.appendChild(inner);
inner.isExposedInstance = true;
return component.id;`);
    const { components } = await read({ scope: "local", within: made });

    expect(components).toHaveLength(1);
    expect(components[0]?.exposed?.map(({ component }) => component)).toEqual(["Button"]);
  });

  it("counts the instances Pricing – Desktop uses: three Plan Cards (T-190)", async () => {
    const { components } = await read({ scope: "used", within: pricingDesktop });

    expect(components.find(({ name }) => name === "Plan Card")).toMatchObject({ instances: 3, remote: false });
    expect(components.find(({ name }) => name === "Button")?.instances).toBeGreaterThan(0);
  });

  it("notes Figma's refusal of Dev Mode links on a plan without them, and still lists the components (FX-065)", async () => {
    const { components, notes } = await read({
      scope: "local",
      within: orbitComponents,
      query: "Plan Card",
      links: true,
    });
    const refused = notes?.find((note) => note.includes("Figma refused them"));

    expect(components.map(({ name }) => name)).toEqual(["Plan Card"]);
    expect(refused ?? "").toMatch(refused === undefined ? /^$/ : /403/);
    expect(refused !== undefined || Array.isArray(components[0]?.links)).toBe(true);
  });

  it("saves Test MCP's components as a library, then a query for card finds Plan Card (T-193)", async () => {
    const home = await mkdtemp(join(tmpdir(), "pixelwright-libraries-"));

    await copyFile(join(homedir(), CHANNEL.home, "bridge.json"), join(home, "bridge.json"));

    const libraries = await new LiveClient().connect({ PIXELWRIGHT_HOME: home });

    try {
      const saved = (await libraries.call("library_search", { file, save: true })) as Libraries;
      const found = (await libraries.call("library_search", { file, query: "card" })) as Libraries;

      expect(saved.saved).toMatchObject({ library: file, path: join(home, "libraries", "test-mcp.json") });
      expect(saved.saved?.components).toBeGreaterThan(1);
      expect(found.components?.map(({ name }) => name)).toContain("Plan Card");
      expect(found.components?.find(({ name }) => name === "Plan Card")?.component).toMatch(/^key:\w+/);
    } finally {
      await libraries.close();
    }
  });
});
