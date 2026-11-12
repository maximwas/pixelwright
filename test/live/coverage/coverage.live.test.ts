import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient, type ToolResult } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { startHere, startSection, orbitPricing, pricingDesktop, planStarter, planPro, signIn, orbitComponents, customers } =
  TEST_MCP.ids;

/** The coverage frame (read only) and the layers of Test MCP the questions point at. */
const COVERAGE_FRAME = "185:239";
const MIXED_RUNS_TEXT = "185:421";

/** The phrases of C1, and the collection C12 makes and removes. */
const PHRASES = ["starter", "team"];
const ALIAS_COLLECTION = "live:coverage:alias";

/** Plugin API helpers every truth walk starts with; the answers of the read tools are compared with what they find. */
const HELPERS = `
const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const shown = (n) => { for (let x = n; x && x.type !== "PAGE"; x = x.parent) if (x.visible === false) return false; return true; };
const pageOf = (n) => { let x = n; while (x.type !== "PAGE") x = x.parent; return x; };
const outermost = (n) => { let x = n; while (x.parent.type !== "PAGE") x = x.parent; return x; };
const strip = (name) => name.split("#")[0];
const node = (id) => figma.getNodeByIdAsync(id);
const diffOf = (inst, defs) => Object.fromEntries(Object.entries(inst.componentProperties).filter(([key, prop]) => defs[key] && prop.value !== defs[key].defaultValue).map(([key, prop]) => [strip(key), prop.value]));
const roundTwo = (value) => Math.round(value * 100) / 100;
`;

/** The raw colours walk: every solid paint, run fill and effect colour bound to no variable and no style. */
const RAW_COLOURS = `
const uses = [];
const paint = (n, p, styled) => {
  if (p.visible === false) return;
  if (p.type === "SOLID" && !p.boundVariables?.color && !styled) uses.push({ id: n.id, hex: hex(p.color) });
  else if (p.gradientStops) for (const stop of p.gradientStops) if (!stop.boundVariables?.color && !styled) uses.push({ id: n.id, hex: hex(stop.color) });
};
for (const n of [root, ...root.findAll(() => true)]) {
  for (const key of ["fills", "strokes"]) {
    const styleId = n[key === "fills" ? "fillStyleId" : "strokeStyleId"];
    if (n.type === "TEXT" && key === "fills" && n.fills === figma.mixed) {
      for (const seg of n.getStyledTextSegments(["fills", "fillStyleId"])) for (const p of seg.fills) paint(n, p, !!seg.fillStyleId);
    } else if (Array.isArray(n[key])) for (const p of n[key]) paint(n, p, typeof styleId === "string" && styleId !== "");
  }
  if (Array.isArray(n.effects) && !n.effectStyleId) for (const e of n.effects) if (e.visible !== false && e.color && !e.boundVariables?.color) uses.push({ id: n.id, hex: hex(e.color) });
}
return uses;
`;

interface Ref {
  readonly id: string;
  readonly name: string;
  readonly type?: string;
}

interface Found {
  readonly id: string;
  readonly path: Ref[];
  readonly page?: Ref;
  readonly hidden?: true;
  readonly fontSize?: number | number[];
  readonly changed?: Record<string, string | boolean>;
  readonly properties?: Record<string, string | boolean>;
}

interface Layer {
  readonly id: string;
  readonly box?: { x: number; y: number; width: number; height: number };
  readonly overflow?: Record<string, number>;
  readonly layout?: Record<string, number | string>;
  readonly parentLayout?: Record<string, number | string>;
  readonly fills?: { css: string; tokens?: Record<string, { value: string; variable: string }> };
  readonly strokes?: { colors: string[]; weight?: number; tokens?: Record<string, { value: string; variable: string }> };
  readonly bound?: Record<string, unknown>;
  readonly component?: { variant: Record<string, string> };
  readonly text?: { segments?: Record<string, unknown>[] };
  readonly path?: Ref[];
  readonly page?: Ref;
}

interface TokenModel {
  readonly collections: {
    modes: string[];
    variables: { id: string; name: string; token: string; values: Record<string, string>; aliasOf?: Record<string, string[]> }[];
  }[];
}

const byId = <Entry extends { id: string }>(entries: readonly Entry[]): Entry[] =>
  [...entries].sort((left, right) => left.id.localeCompare(right.id));

const ids = (entries: readonly { id: string }[]): string[] => byId(entries).map(({ id }) => id);

const smallest = (size: Found["fontSize"]): number => Math.min(...[size ?? Number.POSITIVE_INFINITY].flat());

/** A paint group's colours: its CSS, and the values of the tokens it uses (a bound fill reads var(--x) in css). */
const paintText = (paints?: { css?: string; tokens?: Record<string, { value: string }> }): string =>
  [paints?.css ?? "", ...Object.values(paints?.tokens ?? {}).map(({ value }) => value)].join(" ");

/** The #RRGGBB colours a CSS value or a colour text holds, upper case, from #RGB, #RRGGBB, #RRGGBBAA or rgb()/rgba(). */
const hexesIn = (css: string): string[] =>
  [...css.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b|rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/gi)]
    .map((match) => {
      if (match[1] !== undefined) {
        return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
      }

      const digits = match[0].slice(1);

      return `#${digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits.slice(0, 6)}`.toUpperCase();
    })
    .sort();

/** A token or variable name as one comparable word: `--color-brand` and `color/brand` both become color-brand. */

interface Run {
  readonly start: number;
  readonly end: number;
  readonly characters: string;
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly fontStyle: string;
  readonly textDecoration: string;
}

/** Adjacent runs with the same face, size and decoration as one: the read may split on more fields than the truth asks. */
const mergeRuns = (runs: readonly Run[]): Run[] =>
  runs.reduce<Run[]>((merged, run) => {
    const last = merged.at(-1);

    if (last && last.fontSize === run.fontSize && last.fontFamily === run.fontFamily && last.fontStyle === run.fontStyle && last.textDecoration === run.textDecoration) {
      merged[merged.length - 1] = { ...last, end: run.end, characters: last.characters + run.characters };
    } else {
      merged.push({ start: run.start, end: run.end, characters: run.characters, fontSize: run.fontSize, fontFamily: run.fontFamily, fontStyle: run.fontStyle, textDecoration: run.textDecoration });
    }

    return merged;
  }, []);

const countsOf = (list: readonly { id: string; hex: string }[]): Record<string, number> => {
  const layers: Record<string, Set<string>> = {};

  for (const { id, hex } of list) {
    (layers[hex.toUpperCase()] ??= new Set()).add(id);
  }

  return Object.fromEntries(Object.entries(layers).map(([hex, set]) => [hex, set.size]));
};

// The release gate (memories c89efc91, 7926f1f8): each case asks a question agents put to Figma, takes the truth from
// Plugin API code (execute), the answer from the read tool an agent should use, and expects them equal. It reads
// Test MCP only; C12 makes a collection `live:coverage:alias` and removes it.
describe("coverage/questions", () => {
  const { file } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> =>
    (await client.call("execute", { file, code: `${HELPERS}${code}` })).result;
  const ask = async (tool: string, args: ToolResult = {}): Promise<ToolResult> => await client.call(tool, { file, ...args });
  const inspect = async (args: ToolResult): Promise<Layer[]> => ((await ask("inspect", args)).layers as Layer[]) ?? [];
  const found = async (args: ToolResult): Promise<Found[]> =>
    (await ask("nodes_find", { limit: 500, ...args })).nodes as Found[];

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
    await run(`for (const c of await figma.variables.getLocalVariableCollectionsAsync()) if (c.name === ${JSON.stringify(ALIAS_COLLECTION)}) c.remove();
const collection = figma.variables.createVariableCollection(${JSON.stringify(ALIAS_COLLECTION)});
const base = figma.variables.createVariable("live/base", collection, "COLOR");
const alias = figma.variables.createVariable("live/alias", collection, "COLOR");
base.setValueForMode(collection.defaultModeId, { r: 0.2, g: 0.4, b: 0.6, a: 1 });
alias.setValueForMode(collection.defaultModeId, figma.variables.createVariableAlias(base));`);
  });

  afterAll(async () => {
    try {
      await run(`for (const c of await figma.variables.getLocalVariableCollectionsAsync()) if (c.name === ${JSON.stringify(ALIAS_COLLECTION)}) c.remove();`);
    } finally {
      await client.close();
    }
  });

  it("T1: the visible texts under 14 px on a page, with their sizes", async () => {
    const truth = (await run(`const page = await node(${JSON.stringify(orbitPricing)}); await page.loadAsync();
return page.findAllWithCriteria({ types: ["TEXT"] }).filter(shown).map((t) => ({ id: t.id, size: Math.min(...(t.fontSize === figma.mixed ? t.getStyledTextSegments(["fontSize"]).map((s) => s.fontSize) : [t.fontSize])) })).filter((t) => t.size < 14);`)) as { id: string; size: number }[];
    const nodes = await found({ type: "TEXT", within: orbitPricing, visible: true, fontSize: { lt: 14 } });

    expect(truth.length).toBeGreaterThan(0);
    expect(byId(nodes.map(({ id, fontSize }) => ({ id, size: smallest(fontSize) })))).toEqual(byId(truth));
  });

  it("T2: the raw colours in a frame, with the number of layers each is on", async () => {
    const truth = (await run(`const root = await node(${JSON.stringify(pricingDesktop)});${RAW_COLOURS}`)) as { id: string; hex: string }[];
    const { colors } = (await ask("tokens_usage", { raw: true, within: pricingDesktop })) as {
      colors: { color: string; count: number; layers: { id: string }[] }[];
    };

    expect(truth.length).toBeGreaterThan(0);
    expect(countsOf(colors.flatMap(({ color, layers }) => layers.map(({ id }) => ({ id, hex: color }))))).toEqual(countsOf(truth));
  });

  it("T3: the properties each Plan Card instance changes from the component's defaults", async () => {
    const truth = (await run(`await figma.loadAllPagesAsync();
const main = await (await node(${JSON.stringify(planStarter)})).getMainComponentAsync();
const defs = main.componentPropertyDefinitions;
return Object.fromEntries((await main.getInstancesAsync()).map((inst) => [inst.id, diffOf(inst, defs)]));`)) as Record<string, object>;
    const nodes = await found({ component: "Plan Card", within: "file" });

    expect(Object.keys(truth).length).toBeGreaterThan(1);
    expect(Object.fromEntries(nodes.map(({ id, changed }) => [id, changed ?? {}]))).toEqual(truth);
  });

  it("T4: the auto layout paddings and gaps off a 4 px scale in a frame, side by side", async () => {
    const sides = ["padding-top", "padding-right", "padding-bottom", "padding-left", "gap", "row-gap", "column-gap"];
    const truth = (await run(`const root = await node(${JSON.stringify(COVERAGE_FRAME)});
const off = [];
for (const n of [root, ...root.findAll(() => true)]) {
  if (!n.visible || !("layoutMode" in n) || n.layoutMode === "NONE") continue;
  const add = (prop, value) => { if (typeof value === "number" && Math.abs(value / 4 - Math.round(value / 4)) > 1e-6) off.push(n.id + " " + prop + " " + roundTwo(value)); };
  add("padding-top", n.paddingTop); add("padding-right", n.paddingRight); add("padding-bottom", n.paddingBottom); add("padding-left", n.paddingLeft);
  if (n.layoutMode === "GRID") { add("row-gap", n.gridRowGap); add("column-gap", n.gridColumnGap); continue; }
  // The layout group leaves out a gap of fewer than 2 visible children, a negative one and a line gap equal to the gap written.
  const written = n.primaryAxisAlignItems !== "SPACE_BETWEEN" && n.children.filter((c) => c.visible).length >= 2 && n.itemSpacing >= 0;
  if (written) add("gap", n.itemSpacing);
  if (n.layoutWrap === "WRAP" && n.counterAxisSpacing !== null && n.counterAxisSpacing !== (written ? n.itemSpacing : 0)) add(n.layoutMode === "HORIZONTAL" ? "row-gap" : "column-gap", n.counterAxisSpacing);
}
return off;`)) as string[];
    const reply = await ask("inspect", { within: COVERAGE_FRAME, fields: ["layout"] });
    const layers = (reply.layers as Layer[]) ?? [];
    const answer = layers.flatMap(({ id, layout }) =>
      sides.flatMap((side) => {
        const value = layout?.[side];

        return typeof value === "number" && Math.abs(value / 4 - Math.round(value / 4)) > 1e-6 ? [`${id} ${side} ${value}`] : [];
      }),
    );

    expect(reply.more).toBeUndefined();
    expect(truth.length).toBeGreaterThan(0);
    expect(answer.sort()).toEqual(truth.sort());
  });

  it("T5: the width and the fill of one layer, found by its name", async () => {
    const truth = (await run(`const page = await node(${JSON.stringify(startHere)}); await page.loadAsync();
const map = page.findOne((n) => n.name === "Map");
return { id: map.id, width: map.width, fill: hex(map.fills.find((p) => p.type === "SOLID" && p.visible !== false).color) };`)) as {
      id: string;
      width: number;
      fill: string;
    };
    const named = (await found({ name: "Map", within: startHere })).map(({ id }) => id);
    const [layer] = await inspect({ nodes: [truth.id], fields: ["box", "fills"] });

    expect(named).toContain(truth.id);
    expect({ width: layer?.box?.width, fill: hexesIn(paintText(layer?.fills))[0] }).toEqual({ width: truth.width, fill: truth.fill });
  });

  it("C1: the text layers on any page matching one of several phrases, with their frame ids and visibility", async () => {
    const truth = (await run(`await figma.loadAllPagesAsync();
const phrases = ${JSON.stringify(PHRASES)};
return figma.root.children.flatMap((page) => page.findAllWithCriteria({ types: ["TEXT"] }).filter((t) => phrases.some((phrase) => t.characters.toLowerCase().includes(phrase))).map((t) => ({ id: t.id, frame: outermost(t).id, hidden: !shown(t) })));`)) as {
      id: string;
      frame: string;
      hidden: boolean;
    }[];
    const nodes = await found({ text: PHRASES, within: "file" });

    expect(truth.length).toBeGreaterThan(0);
    expect(byId(nodes.map(({ id, path, hidden }) => ({ id, frame: path[0]?.id ?? id, hidden: hidden === true })))).toEqual(byId(truth));
  });

  it("C2: a frame's children with their page coordinates and sizes", async () => {
    const truth = (await run(`const frame = await node(${JSON.stringify(pricingDesktop)});
return frame.children.map((c) => ({ id: c.id, x: roundTwo(c.absoluteBoundingBox.x), y: roundTwo(c.absoluteBoundingBox.y), width: roundTwo(c.absoluteBoundingBox.width), height: roundTwo(c.absoluteBoundingBox.height) }));`)) as {
      id: string;
    }[];
    const layers = (await inspect({ within: pricingDesktop, depth: 1, fields: ["box"] })).filter(({ id }) => id !== pricingDesktop);
    const rounded = ({ id, box }: Layer) => ({ id, x: Math.round((box?.x ?? 0) * 100) / 100, y: Math.round((box?.y ?? 0) * 100) / 100, width: Math.round((box?.width ?? 0) * 100) / 100, height: Math.round((box?.height ?? 0) * 100) / 100 });

    expect(truth.length).toBeGreaterThan(1);
    expect(byId(layers.map(rounded))).toEqual(byId(truth));
  });

  it("C3: the Button instances in a frame with a property that differs from the default", async () => {
    const truth = (await run(`const frame = await node(${JSON.stringify(pricingDesktop)});
const set = (await (await node(${JSON.stringify(signIn)})).getMainComponentAsync()).parent;
const defs = set.componentPropertyDefinitions;
const out = {};
for (const inst of frame.findAllWithCriteria({ types: ["INSTANCE"] })) {
  const main = await inst.getMainComponentAsync();
  if (main?.parent?.id === set.id) out[inst.id] = diffOf(inst, defs);
}
return out;`)) as Record<string, object>;
    const nodes = await found({ component: "Button", within: pricingDesktop });

    expect(Object.values(truth).some((diff) => Object.keys(diff).length > 0)).toBe(true);
    expect(Object.fromEntries(nodes.map(({ id, changed }) => [id, changed ?? {}]))).toEqual(truth);
  });

  it("C4: the Button instances inside a frame, with their variant", async () => {
    const truth = (await run(`const frame = await node(${JSON.stringify(pricingDesktop)});
const set = (await (await node(${JSON.stringify(signIn)})).getMainComponentAsync()).parent;
const out = {};
for (const inst of frame.findAllWithCriteria({ types: ["INSTANCE"] })) {
  const main = await inst.getMainComponentAsync();
  if (main?.parent?.id === set.id) out[inst.id] = main.variantProperties;
}
return out;`)) as Record<string, Record<string, string>>;
    const nodes = await found({ component: "Button", within: pricingDesktop, properties: true });
    const variantOf = (properties: Record<string, string | boolean> | undefined, wanted: Record<string, string>) =>
      Object.fromEntries(Object.keys(wanted).map((key) => [key, properties?.[key]]));

    expect(Object.keys(truth).length).toBeGreaterThan(1);
    expect(Object.fromEntries(nodes.map(({ id, properties }) => [id, variantOf(properties, truth[id] ?? {})]))).toEqual(
      truth,
    );
  });

  it("C5: every fill, stroke and bound variable under a card", async () => {
    const truth = (await run(`const card = await node(${JSON.stringify(planPro)});
const names = {};
for (const variable of await figma.variables.getLocalVariablesAsync("COLOR")) names[variable.id] = variable.name;
const bound = (list) => Array.isArray(list) ? [...new Set(list.filter((p) => p.visible !== false).flatMap((p) => [p.boundVariables?.color, ...(p.gradientStops ?? []).map((s) => s.boundVariables?.color)]).filter(Boolean).map((alias) => names[alias.id] ?? alias.id))].sort() : [];
const solid = (list) => Array.isArray(list) ? list.filter((p) => p.type === "SOLID" && p.visible !== false).map((p) => hex(p.color)).sort() : [];
return [card, ...card.findAll(() => true)].map((n) => ({ id: n.id, fills: solid(n.fills), strokes: solid(n.strokes), fillVars: bound(n.fills), strokeVars: bound(n.strokes), weight: solid(n.strokes).length > 0 && typeof n.strokeWeight === "number" ? n.strokeWeight : undefined, bound: Object.keys(n.boundVariables ?? {}).filter((key) => !["fills", "strokes", "effects", "textRangeFills"].includes(key)).sort() })).filter((n) => n.fills.length + n.strokes.length + n.bound.length > 0);`)) as {
      id: string;
      fills: string[];
      fillVars: string[];
      strokeVars: string[];
    }[];
    const layers = await inspect({ within: planPro, fields: ["fills", "strokes", "bound"] });
    // T10: each token also names its Figma variable, so the answer key's names compare as they are.
    const named = (tokens: Record<string, { variable: string }> | undefined) => [...new Set(Object.values(tokens ?? {}).map(({ variable }) => variable))].sort();
    const answer = layers.map(({ id, fills, strokes, bound }) => ({
      id,
      fills: hexesIn(paintText(fills)),
      strokes: (strokes?.colors ?? []).flatMap(hexesIn).sort(),
      fillVars: named(fills?.tokens),
      strokeVars: named(strokes?.tokens),
      weight: strokes?.weight,
      bound: Object.keys(bound ?? {}).sort(),
    }));

    expect(truth.length).toBeGreaterThan(3);
    expect(truth.some((entry) => entry.fillVars.length + entry.strokeVars.length > 0)).toBe(true);
    expect(byId(answer.filter((entry) => entry.fills.length + entry.strokes.length + entry.bound.length > 0))).toEqual(byId(truth));
  });

  it("C6: the layers of a frame with a colour that is no style and no variable", async () => {
    const truth = (await run(`const root = await node(${JSON.stringify(customers)});${RAW_COLOURS}`)) as { id: string; hex: string }[];
    const { colors } = (await ask("tokens_usage", { raw: true, within: customers })) as {
      colors: { color: string; layers: { id: string }[] }[];
    };
    const perColour = (list: readonly { id: string; hex: string }[]) =>
      Object.fromEntries(Object.entries(Object.groupBy(list, ({ hex }) => hex.toUpperCase())).map(([hex, rows]) => [hex, [...new Set((rows ?? []).map(({ id }) => id))].sort()]));

    expect(truth.length).toBeGreaterThan(0);
    expect(perColour(colors.flatMap(({ color, layers }) => layers.map(({ id }) => ({ id, hex: color }))))).toEqual(perColour(truth));
  });

  it("C7: a component set's property definitions and variant options", async () => {
    const truth = (await run(`const set = (await (await node(${JSON.stringify(signIn)})).getMainComponentAsync()).parent;
return { name: set.name, variants: set.children.length, properties: Object.fromEntries(Object.entries(set.componentPropertyDefinitions).map(([key, d]) => [strip(key), { type: d.type, default: d.defaultValue, options: d.variantOptions }])) };`)) as {
      name: string;
      variants: number;
      properties: Record<string, object>;
    };
    const { components } = (await ask("components_read", { scope: "local", within: orbitComponents, query: truth.name })) as {
      components: { name: string; variants?: unknown[]; properties: Record<string, object> }[];
    };
    const set = components.find(({ name }) => name === truth.name);

    expect(set?.properties).toEqual(truth.properties);
    expect(set?.variants).toHaveLength(truth.variants);
  });

  it("C8: the layers bound to each property of a component", async () => {
    const truth = (await run(`const main = await (await node(${JSON.stringify(planStarter)})).getMainComponentAsync();
const references = {};
for (const n of main.findAll((n) => n.componentPropertyReferences)) for (const [field, key] of Object.entries(n.componentPropertyReferences)) if (key in main.componentPropertyDefinitions) (references[strip(key)] ??= []).push({ id: n.id, name: n.name, field });
return { name: main.name, references };`)) as { name: string; references: Record<string, { id: string }[]> };
    const { components } = (await ask("components_read", { scope: "local", within: orbitComponents, query: truth.name, references: true })) as {
      components: { name: string; references?: Record<string, { id: string }[]> }[];
    };
    const sorted = (map: Record<string, { id: string }[]> | undefined) =>
      Object.fromEntries(Object.entries(map ?? {}).map(([key, list]) => [key, byId(list)]));

    expect(Object.keys(truth.references).length).toBeGreaterThan(1);
    expect(sorted(components.find(({ name }) => name === truth.name)?.references)).toEqual(sorted(truth.references));
  });

  it("C9: the path from a layer up to its page, with ids", async () => {
    const truth = (await run(`const label = (await node(${JSON.stringify(signIn)})).findAll((n) => n.type === "TEXT")[0];
const path = [];
for (let n = label.parent; n && n.type !== "PAGE"; n = n.parent) path.unshift({ id: n.id, name: n.name, type: n.type });
const page = pageOf(label);
return { id: label.id, characters: label.characters, path, page: { id: page.id, name: page.name } };`)) as {
      id: string;
      characters: string;
      path: Ref[];
      page: Ref;
    };
    const layer = (await found({ text: truth.characters, within: "file" })).find(({ id }) => id === truth.id);

    expect(truth.path.length).toBeGreaterThan(1);
    expect({ path: layer?.path, page: layer?.page }).toEqual({ path: truth.path, page: truth.page });

    const [inspected] = await inspect({ nodes: [truth.id], fields: ["path"] });

    expect({ path: inspected?.path, page: inspected?.page }).toEqual({ path: truth.path, page: truth.page });
  });

  it("C10: a layer's auto layout and its parent's", async () => {
    const truth = (await run(`const card = await node(${JSON.stringify(planStarter)});
const plain = (n) => n.layoutMode !== "NONE" && n.layoutWrap === "NO_WRAP" && n.primaryAxisAlignItems !== "SPACE_BETWEEN" && n.children.length > 1;
const pick = card.findAll((n) => "layoutMode" in n && plain(n) && n.parent && "layoutMode" in n.parent && plain(n.parent))[0];
const sides = (n) => ({ "padding-top": n.paddingTop, "padding-right": n.paddingRight, "padding-bottom": n.paddingBottom, "padding-left": n.paddingLeft, gap: n.itemSpacing });
return { id: pick.id, own: sides(pick), parent: sides(pick.parent) };`)) as {
      id: string;
      own: Record<string, number>;
      parent: Record<string, number>;
    };
    const [layer] = await inspect({ nodes: [truth.id], fields: ["layout"] });
    // The layout group leaves default values out (no padding key means 0, no gap key means 0).
    const read = (layout: Layer["layout"]) => Object.fromEntries(Object.keys(truth.own).map((key) => [key, layout?.[key] ?? 0]));

    expect(read(layer?.layout)).toEqual(truth.own);
    expect(read(layer?.parentLayout)).toEqual(truth.parent);
  });

  it("C11: the hidden layers inside a component", async () => {
    const truth = (await run(`const main = await (await node(${JSON.stringify(planStarter)})).getMainComponentAsync();
return { id: main.id, hidden: main.findAll((n) => !shown(n)).map((n) => ({ id: n.id })) };`)) as {
      id: string;
      hidden: { id: string }[];
    };
    const nodes = await found({ within: truth.id, visible: false });

    expect(truth.hidden.length).toBeGreaterThan(0);
    expect(ids(nodes.filter(({ id }) => id !== truth.id))).toEqual(ids(truth.hidden));
  });

  it("C12: a variable's value, alias chain and modes, by name", async () => {
    const truth = (await run(`const collection = (await figma.variables.getLocalVariableCollectionsAsync()).find((c) => c.name === ${JSON.stringify(ALIAS_COLLECTION)});
const alias = (await figma.variables.getLocalVariablesAsync("COLOR")).find((v) => v.name === "live/alias" && v.variableCollectionId === collection.id);
const modeId = collection.defaultModeId;
const chain = [];
let value = alias.valuesByMode[modeId];
while (value.type === "VARIABLE_ALIAS") { const next = await figma.variables.getVariableByIdAsync(value.id); chain.push(next.name); value = next.valuesByMode[modeId]; }
return { id: alias.id, modes: collection.modes.map((m) => m.name), mode: collection.modes.find((m) => m.modeId === modeId).name, chain, hex: hex(value) };`)) as {
      id: string;
      modes: string[];
      mode: string;
      chain: string[];
      hex: string;
    };
    const model = ((await ask("tokens_read", { format: "json", query: "live/" })) as unknown as { tokens: TokenModel }).tokens;
    const collection = model.collections.find(({ variables }) => variables.some(({ id }) => id === truth.id));
    const alias = collection?.variables.find(({ id }) => id === truth.id);
    const last = alias?.aliasOf?.[truth.mode]?.at(-1);
    const base = collection?.variables.find(({ token }) => token === last);

    expect(collection?.modes).toEqual(truth.modes);
    expect(alias?.aliasOf?.[truth.mode]).toHaveLength(truth.chain.length);
    expect(base?.name).toBe(truth.chain.at(-1));
    expect(hexesIn(base?.values[truth.mode] ?? "")).toEqual([truth.hex]);
  });

  it("C13: the runs of a text with mixed weights or decoration", async () => {
    const truth = (await run(`const text = await node(${JSON.stringify(MIXED_RUNS_TEXT)});
return text.getStyledTextSegments(["fontSize", "fontName", "textDecoration"]).map(({ start, end, characters, fontSize, fontName, textDecoration }) => ({ start, end, characters, fontSize, fontFamily: fontName.family, fontStyle: fontName.style, textDecoration }));`)) as object[];
    const [layer] = await inspect({ nodes: [MIXED_RUNS_TEXT], fields: ["text"] });

    expect(truth.length).toBeGreaterThan(1);
    expect(mergeRuns((layer?.text?.segments ?? []) as unknown as Run[])).toEqual(mergeRuns(truth as Run[]));
  });

  it("C14: where every instance of a main component is, on which page", async () => {
    const truth = (await run(`await figma.loadAllPagesAsync();
const set = (await (await node(${JSON.stringify(signIn)})).getMainComponentAsync()).parent;
const out = {};
for (const inst of figma.root.findAllWithCriteria({ types: ["INSTANCE"] })) {
  const main = await inst.getMainComponentAsync();
  if (main?.parent?.id === set.id) out[inst.id] = pageOf(inst).name;
}
return { setId: set.id, pages: out };`)) as { setId: string; pages: Record<string, string> };
    const nodes = await found({ componentId: truth.setId, within: "file" });

    expect(new Set(Object.values(truth.pages)).size).toBeGreaterThan(1);
    expect(Object.fromEntries(nodes.map(({ id, page }) => [id, page?.name]))).toEqual(truth.pages);
  });

  it("C15: whether a frame's content overflows its height, and by how much", async () => {
    // Its own fixture in the Live tests section: a 200x100 frame that does not clip, with a child 30 px past its bottom.
    const frameId = (await run(`const frame = figma.createFrame();
frame.name = "live:coverage:C15-overflow";
frame.resize(200, 100);
frame.clipsContent = false;
const child = figma.createRectangle();
frame.appendChild(child);
child.resize(100, 50);
child.y = 80;
(await node(${JSON.stringify(startSection)})).appendChild(frame);
return frame.id;`)) as string;

    try {
      const truth = (await run(`const frame = await node(${JSON.stringify(frameId)});
const box = frame.absoluteBoundingBox;
const pad = frame.layoutMode && frame.layoutMode !== "NONE" ? frame.paddingBottom : 0;
return frame.children.filter((c) => c.layoutPositioning !== "ABSOLUTE").map((c) => ({ id: c.id, bottom: roundTwo(c.absoluteBoundingBox.y + c.absoluteBoundingBox.height - (box.y + box.height - pad)) })).filter((c) => c.bottom > 0.5);`)) as {
        id: string;
        bottom: number;
      }[];
      const layers = (await inspect({ within: frameId, depth: 1, fields: ["box"] })).filter(({ id }) => id !== frameId);
      const answer = layers.flatMap(({ id, overflow }) => (overflow?.bottom === undefined ? [] : [{ id, bottom: overflow.bottom }]));

      expect(truth).toHaveLength(1);
      expect(byId(answer)).toEqual(byId(truth));
    } finally {
      await run(`(await node(${JSON.stringify(frameId)}))?.remove();`);
    }
  });
});
