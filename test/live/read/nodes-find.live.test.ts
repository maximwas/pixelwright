import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { startSection, orbitPricing, planStarter, signIn: signInId } = TEST_MCP.ids;

/** How many characters nodes_find gives of a text before it cuts them. */
const TEXT_CHARS = 200;

/** A layer's ancestor or page as nodes_find names it. */
interface Ref {
  readonly id: string;
  readonly name: string;
  readonly type?: string;
}

/** A text's characters as nodes_find gives them: the first 200, with cut when there were more. */
const cutAt = ({ id, characters }: { id: string; characters: string }) =>
  characters.length > TEXT_CHARS
    ? { id, characters: characters.slice(0, TEXT_CHARS), cut: true }
    : { id, characters, cut: undefined };

const byId = <Entry extends { id: string }>(entries: Entry[]): Entry[] =>
  [...entries].sort((left, right) => left.id.localeCompare(right.id));

/** Orbit — Pricing's texts under 14 px a viewer sees (the answer key plugin code computed): all 12 px. */
const SMALL_SHOWN = [
  "54:240",
  "I54:268;54:205;54:188",
  "54:451",
  "54:327",
  "I54:355;54:205;54:188",
  "80:1407",
  "I80:1413;54:205;54:188",
  "81:1619",
];

/** The "Popular" labels inside the hidden badges of the cards that are not popular. */
const HIDDEN_POPULAR = [
  "I54:244;54:205;54:188",
  "I54:292;54:205;54:188",
  "I54:331;54:205;54:188",
  "I54:379;54:205;54:188",
  "I80:1412;54:205;54:188",
  "I80:1414;54:205;54:188",
];

/** Each Plan Card instance's properties that differ from the component's defaults (the answer key). */
const PLAN_CARD_CHANGED: Record<string, Record<string, string | boolean>> = {
  "185:461": { Price: "$29", Popular: true, Name: "Team" },
  "80:1413": { Popular: true },
  "54:244": { Price: "$0", Description: "For side projects and trying things out.", Name: "Starter" },
  "80:1414": { Price: "$29", Description: "For growing teams that ship together.", Name: "Team" },
  "54:331": { Price: "$0", Description: "For side projects and trying things out.", Name: "Starter" },
  "54:292": { Price: "$29", Description: "For growing teams that ship together.", Name: "Team" },
  "80:1412": { Price: "$0", Description: "For side projects and trying things out.", Name: "Starter" },
  "54:379": { Price: "$29", Description: "For growing teams that ship together.", Name: "Team" },
  "54:355": { Popular: true },
  "54:268": { Popular: true },
};
// Plan Card is a plain component with 10 instances (Pricing – Desktop, Mobile, Tablet, and 185:461 in the coverage
// frame 185:239 on Start here); Button is a variant set, and
// "Sign in" 54:236 is its Variant=Secondary, State=Default. Like 0.7.0, `name` matches layer names only and
// `component` matches the main component or its set (the plan's Try-it used `name` for Plan Card, which finds only
// the component itself).
const PLAN_CARD = "Plan Card";
const PLAN_CARD_INSTANCES = 10;
const BUTTON = "Button";
const SIGN_IN = "54:236";

interface Found {
  readonly id: string;
  readonly type: string;
  readonly path: Ref[];
  readonly page?: Ref;
  readonly characters?: string;
  readonly cut?: true;
  readonly properties?: Record<string, string | boolean>;
  readonly hidden?: true;
  readonly fontSize?: number | number[];
  readonly changed?: Record<string, string | boolean>;
}

const smallest = (size: Found["fontSize"]): number => Math.min(...[size ?? Number.POSITIVE_INFINITY].flat());

interface Counted {
  readonly component: string;
  readonly variant?: string;
  readonly count: number;
}

// It only reads: nothing to clean up, and a failed case may run again.
describe("read/nodes_find", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(() => client.close());

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;

  it("finds Plan Card's instances within the file, page by page, with paths and counts (T-040, T-041, T-042)", async () => {
    const { nodes, more, counts, countsCut } = await client.call("nodes_find", {
      file,
      component: PLAN_CARD,
      within: "file",
      counts: true,
    });
    const found = nodes as Found[];

    expect(found).toHaveLength(PLAN_CARD_INSTANCES);
    expect(found.every(({ type, path }) => type === "INSTANCE" && path.length > 0)).toBe(true);
    expect(more).toBe(false);
    expect(countsCut).toBeUndefined();
    expect(counts as Counted[]).toEqual([{ component: PLAN_CARD, count: PLAN_CARD_INSTANCES }]);
  });

  it("finds the instances of one variant, its values in another order and case (T-040)", async () => {
    const { nodes, variant } = await client.call("nodes_find", {
      file,
      component: BUTTON,
      variant: "state=default, variant=secondary",
      within: "file",
    });

    expect((nodes as Found[]).map(({ id }) => id)).toContain(SIGN_IN);
    expect(variant).toEqual({ state: "default", variant: "secondary" });
  });

  it("searches the current page when within is left out (S-043)", async () => {
    const { pages } = await client.call("file_map", { file });
    const current = (pages as { id: string; name: string; current: boolean }[]).find((page) => page.current);
    // T-040: without within the answer also names the page it searched.
    const { page, ...onPage } = await client.call("nodes_find", { file, type: "SECTION" });

    expect(page).toBe(current?.name);
    expect(onPage).toEqual(await client.call("nodes_find", { file, type: "SECTION", within: current?.id }));
    expect((onPage.nodes as Found[]).map(({ id }) => id)).toContain(startSection);
  });

  it("finds the texts under 14 px a viewer sees, with their sizes, and the hidden ones apart", async () => {
    const shown = await client.call("nodes_find", {
      file,
      type: "TEXT",
      within: orbitPricing,
      visible: true,
      limit: 500,
    });
    const small = (shown.nodes as Found[]).filter(({ fontSize }) => smallest(fontSize) < 14);
    const hidden = await client.call("nodes_find", {
      file,
      type: "TEXT",
      within: orbitPricing,
      visible: false,
      limit: 500,
    });
    const popular = (hidden.nodes as Found[]).filter(({ id }) => HIDDEN_POPULAR.includes(id));

    expect(small.map(({ id, fontSize, hidden: flag }) => ({ id, fontSize, flag }))).toEqual(
      SMALL_SHOWN.map((id) => ({ id, fontSize: 12, flag: undefined })),
    );
    expect(popular.map(({ id, hidden: flag, fontSize }) => ({ id, flag, fontSize }))).toEqual(
      HIDDEN_POPULAR.map((id) => ({ id, flag: true, fontSize: 12 })),
    );
    expect((hidden.nodes as Found[]).every(({ hidden: flag }) => flag === true)).toBe(true);
  });

  it("gives each Plan Card instance the properties it changes from the component's defaults", async () => {
    const { nodes } = await client.call("nodes_find", { file, component: PLAN_CARD, within: "file" });

    expect(Object.fromEntries((nodes as Found[]).map(({ id, changed }) => [id, changed]))).toEqual(PLAN_CARD_CHANGED);
  });

  // Gap 1: the texts plugin code found by several phrases or a pattern, and the characters it read.
  it("finds texts by any of several phrases or by a regular expression, each with its characters", async () => {
    const texts = (await run(`const page = await figma.getNodeByIdAsync(${JSON.stringify(orbitPricing)});
await page.loadAsync();
return page.findAll((node) => node.type === "TEXT").map((node) => ({ id: node.id, characters: node.characters }));`)) as {
      id: string;
      characters: string;
    }[];
    const phrases = ["starter", "team"];
    const pattern = "^\\$\\d+";
    const listed = await client.call("nodes_find", { file, within: orbitPricing, text: phrases, limit: 500 });
    const matched = await client.call("nodes_find", { file, within: orbitPricing, textRegex: pattern, limit: 500 });
    const answer = ({ id, characters, cut }: Found) => ({ id, characters, cut });

    expect(byId((listed.nodes as Found[]).map(answer))).toEqual(
      byId(texts.filter(({ characters }) => phrases.some((phrase) => characters.toLowerCase().includes(phrase)))).map(
        cutAt,
      ),
    );
    expect(byId((matched.nodes as Found[]).map(answer))).toEqual(
      byId(texts.filter(({ characters }) => new RegExp(pattern, "i").test(characters))).map(cutAt),
    );
    await expect(client.call("nodes_find", { file, within: orbitPricing, textRegex: "(" })).rejects.toThrow(
      /regular expression/,
    );
  });

  // Gap 7, 8: the shown texts under 14 px plugin code found by their sizes (a mixed text by any run), answered short.
  it("finds the shown texts under 14 px by fontSize, with only the fields asked for", async () => {
    const truth = (await run(`const page = await figma.getNodeByIdAsync(${JSON.stringify(orbitPricing)});
await page.loadAsync();
const shown = (node) => {
  for (let current = node; current.type !== "PAGE"; current = current.parent) if (!current.visible) return false;
  return true;
};
const sizes = (node) => typeof node.fontSize === "number" ? [node.fontSize] : node.getStyledTextSegments(["fontSize"]).map((run) => run.fontSize);
return page.findAll((node) => node.type === "TEXT" && shown(node) && sizes(node).some((size) => size < 14)).map((node) => node.id);`)) as string[];
    const { nodes } = await client.call("nodes_find", {
      file,
      within: orbitPricing,
      type: "TEXT",
      fontSize: { lt: 14 },
      visible: true,
      fields: ["fontSize"],
      limit: 500,
    });

    expect((nodes as Found[]).map(({ id }) => id).sort()).toEqual([...truth].sort());
    expect((nodes as Record<string, unknown>[]).every((node) => !("box" in node) && !("path" in node))).toBe(true);
  });

  // Gap 2: the ancestors plugin code walked up with node.parent, ids and types too, and the page within the file.
  it("gives each layer found its ancestors with ids up to the page, and its page within the file", async () => {
    const { nodes } = await client.call("nodes_find", { file, component: PLAN_CARD, within: "file" });
    const ids = (nodes as Found[]).map(({ id }) => id);
    const truth = await run(`const out = {};
for (const id of ${JSON.stringify(ids)}) {
  const node = await figma.getNodeByIdAsync(id);
  const path = [];
  let current = node.parent;
  while (current.type !== "PAGE") {
    path.unshift({ id: current.id, name: current.name, type: current.type });
    current = current.parent;
  }
  out[id] = { path, page: { id: current.id, name: current.name } };
}
return out;`);

    expect(Object.fromEntries((nodes as Found[]).map(({ id, path, page }) => [id, { path, page }]))).toEqual(truth);
  });

  // Gap 4: the instances plugin code found by their main component's id (a set's through its variants), with values.
  it("finds a component's instances by its id, a set's across its variants, with every property's value", async () => {
    const truth = (await run(`await figma.loadAllPagesAsync();
const card = await (await figma.getNodeByIdAsync(${JSON.stringify(planStarter)})).getMainComponentAsync();
const set = (await (await figma.getNodeByIdAsync(${JSON.stringify(signInId)})).getMainComponentAsync()).parent;
const instances = figma.root.findAllWithCriteria({ types: ["INSTANCE"] });
const of = async (test) => {
  const out = [];
  for (const node of instances) {
    const main = await node.getMainComponentAsync();
    if (main !== null && test(main)) {
      out.push({ id: node.id, properties: Object.fromEntries(Object.entries(node.componentProperties).map(([key, { value }]) => [key.split("#")[0], value])) });
    }
  }
  return out;
};
return { card: card.id, set: set.id, cards: await of((main) => main.id === card.id), buttons: await of((main) => main.parent?.id === set.id) };`)) as {
      card: string;
      set: string;
      cards: { id: string }[];
      buttons: { id: string }[];
    };
    const found = async (componentId: string) =>
      byId(
        (
          (await client.call("nodes_find", { file, componentId, within: "file", properties: true, limit: 500 }))
            .nodes as Found[]
        ).map(({ id, properties }) => ({ id, properties })),
      );

    expect(await found(truth.card)).toEqual(byId(truth.cards));
    expect(await found(truth.set)).toEqual(byId(truth.buttons));
  });
});
