import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { Slug } from "@/core/kernel/names/slug.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { BaselineCapture } from "@/server/app/baselines/baseline-capture.ts";
import { BaselineStore } from "@/server/app/baselines/baseline-store.ts";
import { SeenDesigns } from "@/server/app/baselines/seen-designs.ts";
import { ProjectFolder } from "@/server/app/project/project-folder.ts";
import { SelectedLayer } from "@/server/app/scope/selected-layer.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { BaselineKeeper } from "@/server/tools/baseline-save/baseline-keeper.ts";
import { BaselineSaveOutputSchema } from "@/server/tools/baseline-save/baseline-save.schema.ts";
import { BaselineSaveTool } from "@/server/tools/baseline-save/baseline-save.tool.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

const SESSION = "6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13";

/** When every layer of these tests is read. */
const NOW = "2026-11-04T10:00:00.000Z";

const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });

function layer(
  id: string,
  name: string,
  extra: Partial<ReadLayer> = {},
): ReadLayer {
  return {
    id,
    name,
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    childCount: extra.children?.length ?? 0,
    ...extra,
  };
}

/** Orbit's pricing as the read op gives it: its gap and its title's fill bound to tokens, a padding Figma only inferred. */
function pricing(title = "Plans", children?: ReadLayer[]): ReadModel {
  return {
    model: 1,
    profile: "design",
    root: layer("1:1", "Pricing", {
      boundVariables: { itemSpacing: alias("V:gap") },
      inferred: { paddingLeft: "V:space" },
      children: children ?? [
        layer("1:2", title, { boundVariables: { fills: [alias("V:brand")] } }),
        layer("1:3", "Footnote"),
      ],
    }),
    styles: { "S:1": { name: "Brand", type: "PAINT", remote: false } },
    variables: {
      "V:gap": { name: "gap", collection: "Primitives", resolvedType: "FLOAT", remote: false },
      "V:brand": { name: "brand", collection: "Primitives", resolvedType: "COLOR", remote: false },
      "V:space": { name: "space", collection: "Primitives", resolvedType: "FLOAT", remote: false },
    },
    page: { id: "0:1", name: "Orbit — Pricing" },
  };
}

function variable(
  id: string,
  value: unknown,
  collectionId = "C:1",
) {
  return { id, name: id, collectionId, resolvedType: "FLOAT", scopes: [], valuesByMode: { "M:1": value } };
}

/** The tokens the variables op gives with used: all the file's own, used or not, and a library's an alias reaches. */
const RAW: RawTokens = {
  collections: [
    { id: "C:1", name: "Primitives", remote: false, defaultModeId: "M:1", modes: [{ modeId: "M:1", name: "Light" }] },
    { id: "C:2", name: "Other", remote: false, defaultModeId: "M:2", modes: [{ modeId: "M:2", name: "Light" }] },
  ],
  variables: [
    variable("V:gap", 24),
    variable("V:brand", alias("V:blue")),
    variable("V:blue", alias("V:lib")),
    variable("V:space", 16),
    variable("V:unused", 1, "C:2"),
  ],
  external: {
    "V:lib": { name: "blue/500", collection: "", resolvedType: "COLOR" },
    "V:far": { name: "far", collection: "", resolvedType: "COLOR" },
  },
  styles: [
    { id: "S:1", name: "Brand", type: "PAINT", remote: false },
    { id: "S:2", name: "Unused", type: "PAINT", remote: false },
  ],
  colorProfile: "SRGB",
};

/** Test MCP's plugin: selection, read and variables answered from its fields, every request kept. */
class BaselinePlugin implements PluginLink {
  readonly requests: { op: string; input: unknown }[] = [];
  selection = ["1:1"];
  read = pricing();
  tokens: RawTokens | Error = RAW;

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async state(): Promise<PluginLinkState> {
    throw new Error("only status reads the state");
  }

  role(): PluginLinkRole {
    return "owner";
  }

  files(): readonly ConnectedFile[] {
    return [
      {
        session: SESSION,
        name: "Test MCP",
        key: null,
        page: "Orbit — Pricing",
        editorType: "figma",
        allowEdits: false,
        visible: true,
        active: true,
        pluginVersion: "0.8.0",
      },
    ];
  }

  async request({ op, input }: OpRequest): Promise<unknown> {
    this.requests.push({ op, input });

    if (op === "selection") {
      return { nodes: this.selection.map((id) => ({ id })) };
    }

    if (op === "read") {
      return { reads: [this.read], missing: [], cuts: [] };
    }

    if (this.tokens instanceof Error) {
      throw this.tokens;
    }

    return this.tokens;
  }

  ops(): string[] {
    return this.requests.map(({ op }) => op);
  }
}

const projects: string[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** baseline_save over a temp project folder, never the repo (m:335a001e); its diff finds one change and one new layer. */
async function setup(project?: string) {
  const root = project ?? (await mkdtemp(join(tmpdir(), "pixelwright-baseline-save-")));

  if (project === undefined) {
    projects.push(root);
  }

  const plugin = new BaselinePlugin();
  const store = new BaselineStore(new ProjectFolder({ uris: async () => [] }, root));
  const seen = new SeenDesigns();
  const capture = new BaselineCapture(new SelectedLayer(), plugin, { now: () => Date.parse(NOW) }, new Slug());
  const counts = { changed: 1, added: 1, removed: 0, moved: 0, reordered: 1, components: 0, tokens: 2 };
  const lists = { changed: [], added: [], removed: [], moved: [], reordered: [], components: [], tokens: [] };
  const diff = { compare: () => ({ same: false, changes: { ...lists, notCompared: [] }, counts, more: 0, notes: [] }) };
  const tool = new BaselineSaveTool(
    new PluginSession(SESSION, plugin, []),
    capture,
    new BaselineKeeper(store, diff),
    seen,
  );
  const save = async (args: Record<string, unknown> = {}) =>
    zod.parse(BaselineSaveOutputSchema, (await tool.execute(args)).structuredContent);

  return { root, plugin, store, seen, save };
}

describe("the baseline_save tool", () => {
  it("reads the selected layer with its drawings hashed and keeps it with the tokens it binds and every alias they reach, named as a slug (T-200, K-058)", async () => {
    const { root, plugin, store, save } = await setup();
    const answer = await save({ code: ["src/pricing.tsx"] });

    expect(plugin.requests).toEqual([
      { op: "selection", input: {} },
      { op: "read", input: { nodes: ["1:1"], pathHash: true } },
      { op: "variables", input: { libraries: false, used: true, within: "1:1" } },
    ]);
    expect(answer).toMatchObject({
      name: "pricing",
      path: join(root, ".pixelwright", "baselines", "pricing.json"),
      node: { id: "1:1", name: "Pricing", type: "FRAME" },
      file: { name: "Test MCP", key: null },
      page: { id: "0:1", name: "Orbit — Pricing" },
      capturedAt: NOW,
      code: ["src/pricing.tsx"],
      layers: 3,
      tokens: 5,
      cut: [],
    });
    expect(answer.notes).toEqual([
      `Made .pixelwright/baselines in ${root}: commit it to share baselines with the team, or leave it out of git: it holds the design's texts.`,
      "src/pricing.tsx is not in the project yet.",
    ]);

    const kept = await store.read("pricing");

    expect(kept?.by).toEqual({ server: VERSION, plugin: "0.8.0" });
    // Figma's inferred match (V:space) and the file's unused tokens are no tokens the layer uses (m:335a001e).
    expect(kept?.tokens).toEqual({
      collections: [RAW.collections[0]],
      variables: RAW.variables.filter(({ id }) => ["V:gap", "V:brand", "V:blue"].includes(id)),
      external: { "V:lib": RAW.external["V:lib"] },
      styles: [RAW.styles[0]],
      colorProfile: "SRGB",
    });
  });

  it("refuses a hidden layer before reading its tokens and nothing selected, and notes tokens it could not read (T-200)", async () => {
    const hidden = await setup();

    hidden.plugin.read = { ...pricing(), root: { ...pricing().root, visible: false } };

    await expect(hidden.save({ node: "1:1" })).rejects.toThrow(/^1:1 is hidden in Figma/);
    expect(hidden.plugin.ops()).toEqual(["read"]);

    const none = await setup();

    none.plugin.selection = [];

    await expect(none.save()).rejects.toMatchObject({ code: "NODE_NOT_FOUND" });

    const untokened = await setup();

    untokened.plugin.tokens = new Error("timed out");

    const answer = await untokened.save({ node: "1:1" });

    expect(answer.notes).toContain(
      "The tokens could not be read (timed out): a diff compares them as the reads wrote them, one mode.",
    );
    expect((await untokened.store.read("pricing"))?.tokens).toBeNull();
  });

  it("refuses a name already kept, starts it over with replace saying what that took in, and changes only the files with code alone (T-201)", async () => {
    const { plugin, save } = await setup();

    await save({ name: "pricing", code: ["src/pricing.tsx"] });
    await expect(save({ name: "pricing", node: "1:1" })).rejects.toThrow(
      "pricing exists (Pricing, 1:1, saved 2026-11-04 10:00 UTC): pass the accept a baseline_diff gave, replace: true to start over, code alone to change its files, or another name.",
    );

    plugin.read = pricing("Plans and prices");

    const replaced = await save({ name: "pricing", node: "1:1", replace: true });

    expect(replaced).toMatchObject({
      code: ["src/pricing.tsx"],
      replaced: {
        node: { id: "1:1", name: "Pricing" },
        capturedAt: NOW,
        counts: { changed: 1, added: 1, removed: 0, moved: 0, reordered: 1, components: 0, tokens: 2 },
      },
    });

    const before = plugin.requests.length;
    const codeOnly = await save({ name: "pricing", code: ["src/app/pricing.tsx"] });

    expect(plugin.requests).toHaveLength(before);
    expect(codeOnly).toMatchObject({ code: ["src/app/pricing.tsx"], capturedAt: NOW });
  });

  it("keeps exactly the design a diff compared on accept, reading nothing, and refuses it with more, unknown or stale (T-202)", async () => {
    const { plugin, seen, store, save } = await setup();
    const saved = await save({ name: "pricing" });
    const accept = seen.keep({
      name: "pricing",
      node: saved.node,
      file: saved.file,
      page: saved.page,
      plugin: "0.8.1",
      snapshot: pricing("Accepted"),
      tokens: null,
      capturedAt: "2026-11-04T11:00:00.000Z",
      baselineCapturedAt: saved.capturedAt,
    });
    const before = plugin.requests.length;

    await expect(save({ name: "pricing", accept, node: "1:1" })).rejects.toThrow(
      "accept keeps the design a baseline_diff compared: give the baseline's name with it (and code, to change its files), nothing else.",
    );
    await expect(save({ name: "pricing", accept: "0123456789abcdef" })).rejects.toThrow(
      "That diff is no longer held (the server restarted): run baseline_diff again.",
    );

    const accepted = await save({ name: "pricing", accept, code: ["src/pricing.tsx"] });
    const kept = await store.read("pricing");

    expect(plugin.requests).toHaveLength(before);
    expect(accepted).toMatchObject({ capturedAt: "2026-11-04T11:00:00.000Z", code: ["src/pricing.tsx"] });
    expect(kept?.snapshot.root.children?.[0]?.name).toBe("Accepted");
    expect(kept?.by.plugin).toBe("0.8.1");
    await expect(save({ name: "pricing", accept })).rejects.toThrow(
      "pricing was saved again since that diff: run baseline_diff again.",
    );
  });

  it("refuses code paths outside the project, writes / separators, and lists the shown branches the read's budget cut (T-201, T-203)", async () => {
    const { plugin, save } = await setup();

    plugin.read = pricing("Plans", [
      layer("1:2", "Long list", { childCount: 40, children: [layer("1:4", "One")] }),
      layer("1:5", "Hidden", { visible: false, childCount: 3 }),
    ]);

    await expect(save({ code: ["/etc/passwd"] })).rejects.toThrow(
      "/etc/passwd: code lists the project's files relative to it, inside it.",
    );
    await expect(save({ code: ["../other/app.tsx"] })).rejects.toThrow(/relative to it, inside it/);
    await expect(save({ code: ["C:\\app.tsx"] })).rejects.toThrow(/relative to it, inside it/);

    const answer = await save({ code: ["src\\pricing.tsx"] });

    expect(answer.code).toEqual(["src/pricing.tsx"]);
    expect(answer.cut).toEqual([{ id: "1:2", name: "Long list", children: 40 }]);
    expect(answer.notes.at(-1)).toBe(
      "Save these branches as baselines of their own: baseline_diff does not compare inside them.",
    );
  });

  it("refuses the home folder before it asks the plugin anything (T-200)", async () => {
    const { plugin, save } = await setup(homedir());

    await expect(save()).rejects.toThrow(/is no project folder, so baselines have nowhere to live/);
    expect(plugin.requests).toEqual([]);
  });
});
