import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ConnectedFile } from "@/core/ports/plugin-link.port.ts";
import { BaselineStore } from "@/server/app/baselines/baseline-store.ts";
import type { BaselineFile } from "@/server/app/baselines/baselines.schema.ts";
import { SeenDesigns } from "@/server/app/baselines/seen-designs.ts";
import { ProjectFolder } from "@/server/app/project/project-folder.ts";
import type { Comparison } from "@/server/tools/baseline-diff/baseline-compare.ts";
import { BaselineDiffTool } from "@/server/tools/baseline-diff/baseline-diff.tool.ts";
import { BaselineOverview } from "@/server/tools/baseline-diff/baseline-overview.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

const NOW = "2026-11-04T10:00:00.000Z";
const COUNTS = { changed: 0, added: 0, removed: 0, moved: 0, reordered: 0, components: 0, tokens: 0 };
const LISTS = {
  changed: [],
  added: [],
  removed: [],
  moved: [],
  reordered: [],
  components: [],
  tokens: [],
  notCompared: [],
};
const TEST_MCP: ConnectedFile = {
  session: "s1",
  name: "Test MCP",
  key: null,
  page: "Start here",
  editorType: "figma",
  allowEdits: false,
  visible: true,
  active: true,
  pluginVersion: "0.8.0",
};

function baseline(
  name: string,
  file: string,
  code: string[] = [],
): BaselineFile {
  const root = {
    id: "1:1",
    name: "Pricing",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    childCount: 0,
  };

  return {
    pixelwrightBaseline: 1,
    name,
    capturedAt: NOW,
    by: { server: "0.8.0", plugin: "0.8.0" },
    file: { name: file, key: null },
    page: null,
    node: { id: "1:1", name: "Pricing", type: "FRAME" },
    code,
    version: null,
    snapshot: { model: 1, profile: "design", root, styles: {}, variables: {} },
    tokens: null,
  };
}

/** Compares in Test MCP only, as BaselineTarget finds a baseline's file: changed when its code lists a file. */
const compare = {
  compare: async (kept: BaselineFile): Promise<Comparison> => {
    if (kept.file.name !== TEST_MCP.name) {
      throw new PixelwrightError(ERROR_CODE.fileNotFound, `${kept.file.name} is not connected.`);
    }

    const same = kept.code.length === 0;
    const diff = { same, changes: LISTS, counts: { ...COUNTS, changed: same ? 0 : 1 }, more: 0, notes: [] };

    return { status: same ? "same" : "changed", diff, capture: kept, notes: [] };
  },
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** The overview over a temp project (never the repo, m:335a001e): pricing, plans changed, checkout's file gone, broken. */
async function overview(clock = { now: () => Date.parse(NOW) }) {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-baseline-overview-"));

  roots.push(root);

  const store = new BaselineStore(new ProjectFolder({ uris: async () => [] }, root));
  const kept = [
    baseline("pricing", "Test MCP"),
    baseline("plans", "Test MCP", ["src/plans.tsx"]),
    baseline("checkout", "Gone"),
  ];

  await Promise.all(kept.map((each) => store.write(each)));
  await writeFile(join(root, ".pixelwright", "baselines", "broken.json"), "{");

  const target = { connected: (file: string) => (file === TEST_MCP.name ? TEST_MCP : undefined) };

  return { root, list: new BaselineOverview(store, compare, target, clock) };
}

describe("BaselineOverview (T-204)", () => {
  it("lists every baseline by name with its status, one it cannot read or whose file is not connected unavailable with why", async () => {
    const { list } = await overview();
    const all = await list.all(undefined, new AbortController().signal);

    expect(all.summary).toBe("4 baselines: broken unavailable, checkout unavailable, plans changed, pricing the same.");
    expect(all.baselines.map(({ name, status, reason }) => [name, status, reason])).toEqual([
      ["broken", "unavailable", expect.stringMatching(/broken\.json cannot be read: /)],
      ["checkout", "unavailable", "Gone is not connected."],
      ["plans", "changed", undefined],
      ["pricing", "same", undefined],
    ]);
    expect((await list.all("Test MCP", new AbortController().signal)).summary).toBe(
      "2 baselines: plans changed, pricing the same.",
    );
  });

  it("leaves unchecked the baselines past a minute of checking, and every one after a cancel", async () => {
    let ticks = 0;
    // Each look at the clock is half a minute later: the first baseline is checked, the rest are past the minute.
    const late = (await overview({ now: () => ticks++ * 30_000 })).list;
    const cancelled = new AbortController();

    cancelled.abort();
    expect((await late.all(undefined, new AbortController().signal)).baselines.map(({ status }) => status)).toEqual([
      "unavailable",
      "unchecked",
      "unchecked",
      "unchecked",
    ]);
    expect((await (await overview()).list.all(undefined, cancelled.signal)).summary).toBe(
      "4 baselines: broken unchecked, checkout unchecked, plans unchecked, pricing unchecked.",
    );
  });

  it("answers baseline_diff without a name, refuses node without one, and names a baseline file it cannot read (T-208)", async () => {
    const { root, list } = await overview();
    const tool = new BaselineDiffTool(new SeenDesigns(), compare, list, { signal: new AbortController().signal });
    const broken = join(root, ".pixelwright", "baselines", "broken.json");

    expect((await tool.execute({ file: "Test MCP" })).structuredContent).toMatchObject({
      summary: "2 baselines: plans changed, pricing the same.",
    });
    await expect(tool.execute({ node: "1:1" })).rejects.toThrow(
      "node compares one baseline with another layer: give the baseline's name too.",
    );
    await expect(tool.execute({ name: "broken" })).rejects.toThrow(`${broken} cannot be read: `);
  });
});
