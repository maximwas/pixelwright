import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { startSection, orbitPricing } = TEST_MCP.ids;

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
  readonly path: string[];
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
});
