import { BridgeError, type RawTokens, type Snapshot, type SnapshotNode } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { memoryBaselines } from "../src/baselines/baseline-store.ts";
import { SeenDesigns } from "../src/baselines/seen-designs.ts";
import { saveBaseline } from "../src/features/baseline-save/save-baseline.ts";
import { versionDescription } from "../src/features/version-save/description.ts";
import { versionSaveTool } from "../src/features/version-save/tool.ts";
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
const pricing = (title = "Plans"): Snapshot => ({
  root: node("1:1", "Pricing", [node("1:2", title), node("1:3", "Footnote")]),
  styles: {},
  variables: {},
  page: {
    id: "0:1",
    name: "Pricing page",
  },
});
const TOKENS: RawTokens = {
  collections: [],
  variables: [],
  external: {},
  styles: [],
};

function setup(state: Partial<BaselineFakeState> = {}) {
  const fake: BaselineFakeState = {
    snapshot: pricing(),
    tokens: TOKENS,
    selection: ["1:1"],
    allowEdits: true,
    ...state,
  };
  const recorded = baselineBridge(fake);
  const baselines = memoryBaselines();
  const context = {
    bridge: recorded.bridge,
    plugin: new PluginClient(recorded.bridge),
    baselines,
    seen: new SeenDesigns(),
    projectRoot: "/project",
    version: "0.3.0",
  } as unknown as ToolContext;
  const tool = versionSaveTool(context);

  return {
    fake,
    recorded,
    baselines,
    keep: (name: string) =>
      saveBaseline(context, {
        name,
        replace: false,
      }),
    save: (args: { title: string; description?: string; baselines?: string[] }) =>
      tool.run(args, new AbortController().signal),
  };
}

describe("version_save", () => {
  it("refuses with Allow edits off before it asks the plugin anything", async () => {
    const { recorded, save } = setup({ allowEdits: false });

    await expect(save({ title: "Built: pricing" })).rejects.toMatchObject({ code: "EDITS_DISABLED" });
    expect(recorded.ops()).toEqual([]);
  });

  it("saves with its baselines while they match, composes the description, and has the baselines record it", async () => {
    const { recorded, baselines, keep, save } = setup();

    await keep("pricing");

    const saved = await save({
      title: "Built: pricing",
      description: "First build.",
      baselines: ["pricing"],
    });
    const request = recorded.requests.find(({ op }) => op === "save_version");

    expect(saved).toMatchObject({
      id: "123",
      title: "Built: pricing",
      baselines: ["pricing"],
      notes: [],
    });
    expect(request?.input).toEqual({
      title: "Built: pricing",
      description:
        'First build.\n\nPixelwright baseline "pricing": the code was built from "Pricing" (1:1) as it is in this version.\nSaved by Pixelwright.',
    });
    expect((await baselines.read("pricing"))?.version).toMatchObject({
      id: "123",
      title: "Built: pricing",
    });
  });

  it("refuses a baseline that changed, or that the project does not have, before saving anything", async () => {
    const { fake, recorded, keep, save } = setup();

    await keep("pricing");
    fake.snapshot = pricing("Plans and prices");

    await expect(
      save({
        title: "Built: pricing",
        baselines: ["pricing"],
      }),
    ).rejects.toThrow(/pricing changed since it was saved \(1 layer, 0 tokens\): diff it, update the code and accept/);
    await expect(
      save({
        title: "Built: pricing",
        baselines: ["checkout"],
      }),
    ).rejects.toThrow(/No baseline named checkout/);
    expect(recorded.ops()).not.toContain("save_version");
  });

  it("refuses the same title for ten minutes, unless Figma clearly refused it; a timeout keeps it taken", async () => {
    const refused = setup({ version: new Error("Version history is not available") });

    await expect(refused.save({ title: "Built" })).rejects.toThrow(
      /Figma did not save the version: Version history is not available\. A version needs Can edit access/,
    );
    refused.fake.version = {
      id: "124",
      echo: true,
    };
    expect((await refused.save({ title: "built " })).id).toBe("124");
    await expect(refused.save({ title: "Built" })).rejects.toThrow(/A version named Built was saved here 1 minute ago/);

    const timedOut = setup({ version: new BridgeError("TIMEOUT", "The plugin did not answer in time.") });

    await expect(timedOut.save({ title: "Built" })).rejects.toMatchObject({ code: "TIMEOUT" });
    await expect(timedOut.save({ title: "Built" })).rejects.toThrow(/or may have been: that try timed out/);
  });

  it("says when an older plugin saved the title only, Figma gave no id, or the plugin cannot save versions", async () => {
    const titleOnly = setup({
      version: {
        id: null,
        echo: false,
      },
    });

    expect((await titleOnly.save({ title: "Built" })).notes).toEqual([
      "This plugin saved the title only: update it with npx -y pixelwright@latest.",
      "Figma saved the version without giving its id.",
    ]);

    const old = setup({ version: new BridgeError("UNKNOWN_OP", "Unknown operation: save_version") });

    await expect(old.save({ title: "Built" })).rejects.toThrow(/older than the server and cannot save versions/);
  });

  it("names three baselines in the description, then how many more, within Figma's length", () => {
    const baseline = (name: string) =>
      ({
        name,
        node: {
          id: "1:1",
          name: "Pricing",
          type: "FRAME",
        },
      }) as Parameters<typeof versionDescription>[1][number];
    const text = versionDescription("x".repeat(990), ["a", "b", "c", "d", "e"].map(baseline));

    expect(text).toHaveLength(1_000);
    expect(versionDescription(undefined, ["a", "b", "c", "d"].map(baseline)).split("\n").slice(-2)).toEqual([
      "and 1 more",
      "Saved by Pixelwright.",
    ]);
  });
});
