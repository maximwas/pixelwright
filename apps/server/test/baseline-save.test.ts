import { mkdtemp } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { RawTokens, Snapshot, SnapshotNode } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { folderBaselines, memoryBaselines } from "../src/baselines/baseline-store.ts";
import { SeenDesigns } from "../src/baselines/seen-designs.ts";
import { saveBaseline } from "../src/features/baseline-save/save-baseline.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
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

function pricing(title = "Plans"): Snapshot {
  return {
    root: node("1:1", "Pricing", [text("1:2", title), text("1:3", "Footnote")]),
    styles: {},
    variables: {},
    page: {
      id: "0:1",
      name: "Orbit — Pricing",
    },
  };
}

function setup(state: Partial<BaselineFakeState> = {}) {
  const fake: BaselineFakeState = {
    snapshot: pricing(),
    tokens: TOKENS,
    selection: ["1:1"],
    ...state,
  };
  const { bridge, requests, ops } = baselineBridge(fake);
  const baselines = memoryBaselines();
  const seen = new SeenDesigns();
  const context = {
    plugin: new PluginClient(bridge),
    baselines,
    seen,
    projectRoot: "/project",
    version: "0.3.0",
  };

  return {
    fake,
    requests,
    ops,
    baselines,
    seen,
    save: (args: Parameters<typeof saveBaseline>[1]) => saveBaseline(context, args),
  };
}

const args = (extra: Partial<Parameters<typeof saveBaseline>[1]> = {}) => ({
  replace: false,
  ...extra,
});

describe("baseline_save", () => {
  it("reads the selected layer and the tokens it uses on one session, and keeps them under its name as a slug", async () => {
    const { requests, ops, baselines, save } = setup();
    const answer = await save(args({ code: ["src/pricing.tsx"] }));

    expect(ops()).toEqual(["selection", "snapshot", "variables"]);
    expect(requests.slice(1).map(({ input }) => input)).toEqual([
      {
        node: "1:1",
        css: "unmapped",
        paths: true,
      },
      {
        used: true,
        within: "1:1",
      },
    ]);
    expect(new Set(requests.map(({ session }) => session))).toEqual(new Set(["s1"]));
    expect(answer).toMatchObject({
      name: "pricing",
      path: "/project/.pixelwright/baselines/pricing.json",
      node: {
        id: "1:1",
        name: "Pricing",
        type: "FRAME",
      },
      page: {
        id: "0:1",
        name: "Orbit — Pricing",
      },
      code: ["src/pricing.tsx"],
      layers: 3,
      cut: [],
    });
    expect(answer.notes).toEqual([
      expect.stringMatching(/^Made \.pixelwright\/baselines in \/project: commit it/),
      "src/pricing.tsx is not in the project yet.",
    ]);
    expect((await baselines.read("pricing"))?.snapshot.root.id).toBe("1:1");
  });

  it("refuses a hidden layer, and nothing or several layers selected", async () => {
    const hidden = setup({
      snapshot: {
        ...pricing(),
        root: {
          ...pricing().root,
          visible: false,
        },
      },
    });

    await expect(hidden.save(args({ node: "1:1" }))).rejects.toThrow(/is hidden in Figma/);
    await expect(setup({ selection: [] }).save(args())).rejects.toMatchObject({ code: "NODE_NOT_FOUND" });
  });

  it("refuses a name already kept, starts it over with replace and says what that took in, and changes only the files with code alone", async () => {
    const { fake, ops, save } = setup();

    await save(args({ name: "pricing" }));
    await expect(
      save(
        args({
          name: "pricing",
          node: "1:1",
        }),
      ),
    ).rejects.toThrow(/pricing exists \(Pricing, 1:1, saved \d{4}-\d\d-\d\d \d\d:\d\d UTC\): pass the accept/);

    fake.snapshot = pricing("Plans and prices");

    const replaced = await save(
      args({
        name: "pricing",
        node: "1:1",
        replace: true,
      }),
    );

    expect(replaced.replaced?.counts.changed).toBe(1);

    const before = ops().length;
    const codeOnly = await save(
      args({
        name: "pricing",
        code: ["src/app/pricing.tsx"],
      }),
    );

    expect(ops()).toHaveLength(before);
    expect(codeOnly.code).toEqual(["src/app/pricing.tsx"]);
  });

  it("keeps exactly the design a diff compared on accept, reading nothing, and refuses a stale or unknown accept", async () => {
    const { ops, seen, baselines, save } = setup();
    const saved = await save(args({ name: "pricing" }));
    const stored = await baselines.read("pricing");
    const accept = seen.keep({
      name: "pricing",
      node: saved.node,
      file: saved.file,
      page: saved.page,
      plugin: "0.3.0",
      snapshot: pricing("Accepted"),
      tokens: null,
      capturedAt: "2026-10-14T10:00:00.000Z",
      baselineCapturedAt: stored?.capturedAt ?? "",
    });
    const before = ops().length;

    await expect(
      save(
        args({
          name: "pricing",
          accept: "0123456789abcdef",
        }),
      ),
    ).rejects.toThrow(/no longer held/);

    const accepted = await save(
      args({
        name: "pricing",
        accept,
      }),
    );

    expect(ops()).toHaveLength(before);
    expect(accepted.capturedAt).toBe("2026-10-14T10:00:00.000Z");
    expect((await baselines.read("pricing"))?.snapshot.root.children?.[0]?.name).toBe("Accepted");
    await expect(
      save(
        args({
          name: "pricing",
          accept,
        }),
      ),
    ).rejects.toThrow(/pricing was saved again since that diff/);
  });

  it("refuses code paths outside the project, and lists the branches the read did not hold whole", async () => {
    const cut = setup({
      snapshot: {
        ...pricing(),
        root: node("1:1", "Pricing", [node("1:2", "Long list", [text("1:3", "One")], { childCount: 40 })]),
      },
    });

    await expect(cut.save(args({ code: ["/etc/passwd"] }))).rejects.toThrow(/relative to it, inside it/);
    await expect(cut.save(args({ code: ["../other/app.tsx"] }))).rejects.toThrow(/relative to it, inside it/);

    const answer = await cut.save(args({ code: ["src\\pricing.tsx"] }));

    expect(answer.code).toEqual(["src/pricing.tsx"]);
    expect(answer.cut).toEqual([
      {
        id: "1:2",
        name: "Long list",
        children: 40,
      },
    ]);
    expect(answer.notes.at(-1)).toBe(
      "Save these branches as baselines of their own: baseline_diff does not compare inside them.",
    );
  });

  it("refuses the home folder before it asks the plugin anything", async () => {
    const { ops } = setup();
    const context = {
      plugin: new PluginClient(
        baselineBridge({
          snapshot: pricing(),
          tokens: TOKENS,
          selection: ["1:1"],
        }).bridge,
      ),
      baselines: folderBaselines(homedir()),
      seen: new SeenDesigns(),
      projectRoot: homedir(),
      version: "0.3.0",
    };

    await expect(saveBaseline(context, args())).rejects.toThrow(/is no project folder/);
    expect(ops()).toEqual([]);
  });

  it("writes into a real project folder", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixelwright-save-"));
    const { bridge } = baselineBridge({
      snapshot: pricing(),
      tokens: TOKENS,
      selection: ["1:1"],
    });
    const answer = await saveBaseline(
      {
        plugin: new PluginClient(bridge),
        baselines: folderBaselines(root),
        seen: new SeenDesigns(),
        projectRoot: root,
        version: "0.3.0",
      },
      args(),
    );

    expect(answer.path).toBe(join(root, ".pixelwright", "baselines", "pricing.json"));
  });
});
