import type { RawTokens, Snapshot, SnapshotNode } from "@pixelwright/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryBaselines } from "../src/baselines/baseline-store.ts";
import { SeenDesigns } from "../src/baselines/seen-designs.ts";
import { baselineDiffTool } from "../src/features/baseline-diff/tool.ts";
import { saveBaseline } from "../src/features/baseline-save/save-baseline.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { ToolContext } from "../src/types/mcp.ts";
import { type BaselineFakeState, baselineBridge } from "./helpers/baseline-bridge.ts";

const node = (
  id: string,
  name: string,
  children: SnapshotNode[] = [],
  extra: Partial<SnapshotNode> = {},
): SnapshotNode => ({
  id,
  name,
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  childCount: children.length,
  children,
  ...extra,
});
const text = (id: string, characters: string): SnapshotNode =>
  node(id, characters, [], {
    type: "TEXT",
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [],
    },
  });
const TOKENS: RawTokens = {
  collections: [],
  variables: [],
  external: {},
  styles: [],
};
const page = (root: SnapshotNode): Snapshot => ({
  root,
  styles: {},
  variables: {},
  page: {
    id: "0:1",
    name: "Pricing page",
  },
});
const pricing = (note = "Taxes may apply.") => page(node("1:1", "Pricing", [text("1:2", "Plans"), text("1:3", note)]));

function setup(state: Partial<BaselineFakeState> = {}) {
  const fake: BaselineFakeState = {
    snapshot: pricing(),
    tokens: TOKENS,
    selection: ["1:1"],
    ...state,
  };
  const recorded = baselineBridge(fake);
  const baselines = memoryBaselines();
  const seen = new SeenDesigns();
  const context = {
    bridge: recorded.bridge,
    plugin: new PluginClient(recorded.bridge),
    baselines,
    seen,
    projectRoot: "/project",
    version: "0.3.0",
  } as unknown as ToolContext;
  const tool = baselineDiffTool(context);

  return {
    fake,
    recorded,
    baselines,
    seen,
    save: (name: string) =>
      saveBaseline(context, {
        name,
        replace: false,
      }),
    diff: (args: { name?: string; node?: string; file?: string }) => tool.run(args, new AbortController().signal),
    tool,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("baseline_diff: one baseline", () => {
  it("reads the same right after it was saved, and lists a change with an accept once the design changed", async () => {
    const { fake, save, diff } = setup();

    await save("pricing");
    expect(await diff({ name: "pricing" })).toMatchObject({
      summary: expect.stringMatching(/^pricing: Pricing \(1:1\) reads as on /),
      baselines: [{ status: "same" }],
    });

    fake.snapshot = pricing("Billed yearly.");

    const changed = await diff({ name: "pricing" });

    expect(changed.baselines[0]?.status).toBe("changed");
    expect(changed.summary).toMatch(/since .* UTC: 1 layer changed\.$/);
    expect(changed.changes?.changed[0]?.attributes.$text).toEqual(["Taxes may apply.", "Billed yearly."]);
    expect(changed.accept).toMatch(/^[0-9a-f]{16}$/);
  });

  it("finds a root made again by its exact name, and says missing when no one layer has it", async () => {
    const { fake, save, diff } = setup();

    await save("pricing");
    fake.snapshot = page(node("9:9", "Pricing", [text("9:10", "Plans"), text("9:11", "Taxes may apply.")]));

    const found = await diff({ name: "pricing" });

    // The frame was made again: it is a change with what it was, so code naming the old id follows; under it every id is new.
    expect(found.baselines[0]).toMatchObject({
      status: "changed",
      now: {
        id: "9:9",
        name: "Pricing",
      },
    });
    expect(found.changes?.changed.map(({ id, was }) => [id, was])).toEqual([["9:9", "1:1"]]);
    expect(found.notes).toContain("1:1 is gone: compared with Pricing (9:9), the one layer of its name.");

    fake.snapshot = page(node("9:9", "Pricing v2", [node("9:8", "Pricing v3")]));

    expect((await diff({ name: "pricing" })).baselines[0]).toMatchObject({
      status: "missing",
      reason: expect.stringMatching(/Pricing \(1:1\) is gone; layers like it: Pricing v2 \(9:9\), Pricing v3 \(9:8\)/),
    });
  });

  it("looks on the current page when the root's page was deleted, and says missing when it is not there", async () => {
    const { fake, save, diff } = setup();

    await save("pricing");
    fake.deletedPage = "0:1";
    fake.snapshot = page(node("9:9", "Pricing", [text("9:10", "Plans"), text("9:11", "Taxes may apply.")]));

    expect((await diff({ name: "pricing" })).baselines[0]).toMatchObject({
      status: "changed",
      now: { id: "9:9" },
    });

    fake.snapshot = page(node("9:9", "Checkout", []));

    expect((await diff({ name: "pricing" })).baselines[0]).toMatchObject({ status: "missing" });
  });

  it("says hidden for a hidden root, unavailable when the id names another layer, and compares node when given", async () => {
    const { fake, save, diff } = setup();

    await save("pricing");
    fake.snapshot = page({
      ...pricing().root,
      visible: false,
    });
    expect((await diff({ name: "pricing" })).baselines[0]?.status).toBe("hidden");

    fake.snapshot = page(node("1:1", "Footnote", [], { type: "TEXT" }));
    expect((await diff({ name: "pricing" })).baselines[0]).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("is this the right file? Pass node to compare anyway"),
    });

    fake.snapshot = pricing();
    expect(
      (
        await diff({
          name: "pricing",
          node: "1:1",
        })
      ).baselines[0]?.status,
    ).toBe("same");
  });

  it("notes a read by another plugin version, and refuses a name the project does not have", async () => {
    const { save, diff, baselines } = setup();

    await save("pricing");

    const stored = await baselines.read("pricing");

    if (stored !== null) {
      await baselines.write({
        ...stored,
        by: {
          server: "0.3.0",
          plugin: "0.2.0",
        },
      });
    }

    expect((await diff({ name: "pricing" })).notes).toContain(
      "Read by plugin 0.2.0, now 0.3.0: a change that comes from the newer reading goes away when you accept.",
    );
    await expect(diff({ name: "checkout" })).rejects.toThrow(
      /No baseline named checkout in this project \(it has pricing\)/,
    );
  });
});

describe("baseline_diff: every baseline", () => {
  it("lists every baseline by name with its status and counts", async () => {
    const { fake, save, diff } = setup();

    await save("pricing");
    await save("checkout");
    fake.snapshot = pricing("Billed yearly.");

    const overview = await diff({});

    expect(overview.summary).toBe("2 baselines: checkout changed, pricing changed.");
    expect(overview.baselines.map(({ name, counts }) => [name, counts?.changed])).toEqual([
      ["checkout", 1],
      ["pricing", 1],
    ]);
    expect(overview).not.toHaveProperty("changes");
  });

  it("still lists the baselines with no plugin connected, each unavailable", async () => {
    const { recorded, save, diff } = setup();

    await save("pricing");
    recorded.bridge.plugins = () => [];

    expect((await diff({})).baselines[0]).toMatchObject({
      name: "pricing",
      status: "unavailable",
      reason: expect.stringContaining("No Figma file is connected"),
    });
  });

  it("leaves the baselines past a minute unchecked", async () => {
    const { recorded, save, diff } = setup();

    await save("a");
    await save("b");

    const run = recorded.bridge.request;

    vi.useFakeTimers();
    recorded.bridge.request = async (...args) => {
      vi.advanceTimersByTime(61_000);

      return run(...args);
    };

    expect((await diff({})).baselines.map(({ status }) => status)).toEqual(["same", "unchecked"]);
  });
});
