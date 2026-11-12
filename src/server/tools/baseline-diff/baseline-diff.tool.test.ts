import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { CssReader } from "@/core/css/css-reader.ts";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { TextPathData } from "@/core/css/groups/text/text-path-data.ts";
import { TextRun } from "@/core/css/groups/text/text-run.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { GroupRegistry } from "@/core/css/registry/group-registry.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { AssetClassifier } from "@/core/design/assets/asset-classifier.ts";
import { AssetCss } from "@/core/design/assets/asset-css.ts";
import { AssetPlanner } from "@/core/design/assets/asset-planner.ts";
import { DesignBuilder } from "@/core/design/builder/design-builder.ts";
import { ComponentAttributes } from "@/core/design/component/component-attributes.ts";
import { InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { TextContent } from "@/core/design/text/text-content.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { BaselineDiff } from "@/core/diff/baseline/baseline-diff.ts";
import { LayerChanges } from "@/core/diff/baseline/layer-changes.ts";
import { StructureChanges } from "@/core/diff/baseline/structure-changes.ts";
import { Fingerprint } from "@/core/diff/fingerprint.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { Slug } from "@/core/kernel/names/slug.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import { BaselineCapture } from "@/server/app/baselines/baseline-capture.ts";
import { BaselineStore } from "@/server/app/baselines/baseline-store.ts";
import { SeenDesigns } from "@/server/app/baselines/seen-designs.ts";
import { ProjectFolder } from "@/server/app/project/project-folder.ts";
import { SelectedLayer } from "@/server/app/scope/selected-layer.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { PluginSessions } from "@/server/app/sessions/plugin-sessions.ts";
import { TargetResolver } from "@/server/app/sessions/target-resolver.ts";
import { BaselineCompare } from "@/server/tools/baseline-diff/baseline-compare.ts";
import { BaselineDiffOutputSchema } from "@/server/tools/baseline-diff/baseline-diff.schema.ts";
import { BaselineDiffTool } from "@/server/tools/baseline-diff/baseline-diff.tool.ts";
import { BaselineOverview } from "@/server/tools/baseline-diff/baseline-overview.ts";
import { BaselineRoot } from "@/server/tools/baseline-diff/baseline-root.ts";
import { BaselineTarget } from "@/server/tools/baseline-diff/baseline-target.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

const SESSION = "6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13";
const NOW = "2026-11-04T10:00:00.000Z";
const TOKENS = { collections: [], variables: [], external: {}, styles: [] };

/** design_read's tree without CSS: names, texts and structure are what these cases change. */
const format = new NumberFormat();
const names = new TokenNames();
const lengths = new CssLength(new CssVar(new CssSplit()), format, names);
const solid = new SolidPaint(names);
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
  names,
);
const tree = new LayerTree(
  new DesignBuilder(
    new NodeTag(),
    new ComponentAttributes(new NameValueList(), names),
    new CssReader(new GroupRegistry([])),
    new TextPathData(),
  ),
  new TextContent(new TextRun(new FontShorthand(format, new FontWeight()), paints, format, names)),
  new InteractionAttributes(new EasingCss(format)),
  new AssetPlanner(new AssetClassifier(), new Slug(), new AssetCss(lengths, new CssSplit())),
);
const writer = new XmlWriter(new XmlEscape());

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

function text(
  id: string,
  name: string,
  characters: string,
): ReadLayer {
  const segment = {
    characters,
    start: 0,
    end: characters.length,
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 16,
    fontWeight: 400,
    textDecoration: "NONE",
    textCase: "ORIGINAL",
    lineHeight: { unit: "AUTO" },
    letterSpacing: { unit: "PIXELS", value: 0 },
    fills: [],
    fillStyleId: "",
    textStyleId: "",
  };
  const content = {
    characters,
    textAutoResize: "WIDTH_AND_HEIGHT",
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    segments: [segment],
  };

  return layer(id, name, { type: "TEXT", text: content });
}

function page(root: ReadLayer): ReadModel {
  return { model: 1, profile: "design", root, styles: {}, variables: {}, page: { id: "0:1", name: "Orbit — Pricing" } };
}

const pricing = (note = "Taxes may apply.", id = "1") =>
  page(
    layer(`${id}:1`, "Pricing", {
      layoutMode: "VERTICAL",
      children: [text(`${id}:2`, "Plans", "Plans"), text(`${id}:3`, "Note", note)],
    }),
  );

/** Test MCP's plugin with another file active: its layers answer read, outline and find; every request is kept. */
class DiffPlugin implements PluginLink {
  readonly requests: { session: string; op: string; input: unknown }[] = [];
  read = pricing();
  version = "0.8.0";
  deletedPage: string | null = null;

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async state(): Promise<PluginLinkState> {
    throw new Error("only status reads the state");
  }

  role(): PluginLinkRole {
    return "owner";
  }

  files(): readonly ConnectedFile[] {
    const file = {
      key: null,
      page: "Orbit — Pricing",
      editorType: "figma",
      allowEdits: false,
      visible: true,
      pluginVersion: this.version,
    };

    return [
      { ...file, session: "other", name: "Other", active: true },
      { ...file, session: SESSION, name: "Test MCP", active: false },
    ];
  }

  async request({ session, op, input }: OpRequest): Promise<unknown> {
    this.requests.push({ session, op, input });

    const asked = input as { nodes?: string[]; node?: string; name?: string; type?: string; within?: string };
    const layers = [...new ReadLayers().walk(this.read.root)].map((walked) => walked.layer);

    if (op === "read") {
      const id = asked.nodes?.[0];

      return { reads: id === this.read.root.id ? [this.read] : [], missing: [], cuts: [] };
    }

    if (op === "outline") {
      const found = layers.find((each) => each.id === asked.node);

      if (found === undefined) {
        throw new PixelwrightError(ERROR_CODE.nodeNotFound, `${asked.node} is gone`);
      }

      return { root: { id: found.id, name: found.name, type: found.type } };
    }

    if (op === "find") {
      if (asked.within !== undefined && asked.within === this.deletedPage) {
        throw new PixelwrightError(ERROR_CODE.nodeNotFound, `${asked.within} is gone`);
      }

      const like = layers.filter((each) => each.name.includes(asked.name ?? "") && each.type === asked.type);

      return { nodes: like.map(({ id, name, type }) => ({ id, name, type, path: [] })), more: false };
    }

    return TOKENS;
  }
}

const projects: string[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** baseline_diff over a temp project folder, never the repo (m:335a001e), with "pricing" saved from Test MCP. */
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-baseline-diff-"));

  projects.push(root);

  const plugin = new DiffPlugin();
  const store = new BaselineStore(new ProjectFolder({ uris: async () => [] }, root));
  const seen = new SeenDesigns();
  const capture = new BaselineCapture(new SelectedLayer(), plugin, { now: () => Date.parse(NOW) }, new Slug());
  const baselines = new BaselineDiff(
    tree,
    new LayerChanges(new Fingerprint(), new CssUrl(new CssSplit()), new NameValueList(), writer),
    new StructureChanges(writer),
    { of: () => [] },
  );
  const sessions = new PluginSessions(plugin, new TargetResolver(), []);
  const compare = new BaselineCompare(new BaselineTarget(plugin, sessions), new BaselineRoot(), capture, baselines);
  const overview = new BaselineOverview(store, compare, { connected: () => undefined }, { now: Date.now });
  const tool = new BaselineDiffTool(seen, compare, overview, { signal: new AbortController().signal });
  const saved = await capture.capture(new PluginSession(SESSION, plugin, []), "1:1", "pricing");

  if ("baseline" in saved) {
    await store.write(saved.baseline);
  }

  plugin.requests.length = 0;

  const diff = async (args: Record<string, unknown>) =>
    zod.parse(BaselineDiffOutputSchema, (await tool.execute(args)).structuredContent);

  return { root, plugin, store, seen, diff };
}

describe("the baseline_diff tool: one baseline", () => {
  it("reads the same right after it was saved, then lists a change with an accept, read in its own file (T-205, T-207)", async () => {
    const { plugin, seen, diff } = await setup();

    expect(await diff({ name: "pricing" })).toMatchObject({
      summary: "pricing: Pricing (1:1) reads as on 2026-11-04 10:00 UTC.",
      baselines: [{ name: "pricing", node: { id: "1:1" }, status: "same", counts: { changed: 0, added: 0 } }],
    });

    plugin.read = pricing("Billed yearly.");

    const changed = await diff({ name: "pricing" });

    expect(changed).toMatchObject({
      summary: "pricing: Pricing (1:1) since 2026-11-04 10:00 UTC: 1 layer changed.",
      baselines: [{ status: "changed" }],
      changes: {
        changed: [{ path: 'Text "Note"', id: "1:3", attributes: { $text: ["Taxes may apply.", "Billed yearly."] } }],
      },
      accept: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(seen.get(changed.accept ?? "")).toMatchObject({
      name: "pricing",
      node: { id: "1:1" },
      baselineCapturedAt: NOW,
    });
    expect(new Set(plugin.requests.map(({ session }) => session))).toEqual(new Set([SESSION]));
    expect(plugin.requests).toContainEqual({ session: SESSION, op: "read", input: { nodes: ["1:1"], pathHash: true } });
  });

  it("finds a root made again by its exact name, on the current page when its page is gone, else says missing with look-alikes (T-206)", async () => {
    const { plugin, diff } = await setup();

    plugin.read = pricing("Taxes may apply.", "9");

    const found = await diff({ name: "pricing" });

    expect(found.baselines[0]).toMatchObject({ status: "changed", now: { id: "9:1", name: "Pricing" } });
    expect(found.changes?.changed.map(({ id, was }) => [id, was])).toEqual([["9:1", "1:1"]]);
    expect(found.notes).toContain("1:1 is gone: compared with Pricing (9:1), the one layer of its name.");
    expect(plugin.requests.find(({ op }) => op === "find")?.input).toMatchObject({ within: "0:1" });

    plugin.deletedPage = "0:1";
    expect((await diff({ name: "pricing" })).baselines[0]).toMatchObject({ status: "changed", now: { id: "9:1" } });

    plugin.read = page(layer("9:9", "Pricing v2", { children: [layer("9:8", "Pricing v3")] }));
    expect((await diff({ name: "pricing" })).baselines[0]).toMatchObject({
      status: "missing",
      reason:
        'Pricing (1:1) is gone; layers like it: Pricing v2 (9:9), Pricing v3 (9:8): pass node to compare one, or baseline_save {name: "pricing", node, replace: true} to start over.',
    });
  });

  it("says hidden for a hidden root, unavailable when its id names another layer, and compares node when given (T-206)", async () => {
    const { plugin, diff } = await setup();

    plugin.read = page({ ...pricing().root, visible: false });
    expect((await diff({ name: "pricing" })).baselines[0]?.status).toBe("hidden");

    plugin.read = page(text("1:1", "Footnote", "Footnote"));
    expect((await diff({ name: "pricing" })).baselines[0]).toMatchObject({
      status: "unavailable",
      reason:
        "1:1 in Test MCP is a TEXT named Footnote, not the FRAME this baseline holds: is this the right file? Pass node to compare anyway.",
    });

    plugin.read = pricing();
    expect((await diff({ name: "pricing", node: "1:1" })).baselines[0]).toMatchObject({
      status: "same",
      now: { id: "1:1" },
    });
  });

  it("notes a read by another plugin version, and refuses an unknown name naming the project's (T-207, T-208)", async () => {
    const { plugin, diff } = await setup();

    plugin.version = "0.9.0";
    expect((await diff({ name: "pricing" })).notes).toContain(
      "Read by plugin 0.8.0, now 0.9.0: a change that comes from the newer reading goes away when you accept.",
    );
    await expect(diff({ name: "checkout" })).rejects.toThrow(
      "No baseline named checkout in this project (it has pricing): baseline_save keeps one.",
    );
  });
});
