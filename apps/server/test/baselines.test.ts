import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { BaselineFile } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { folderBaselines } from "../src/baselines/baseline-store.ts";
import { baselineTarget } from "../src/baselines/baseline-target.ts";
import { SeenDesigns } from "../src/baselines/seen-designs.ts";
import type { ConnectedPlugin } from "../src/types/bridge.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A baseline as baseline_save writes it, of a frame with nothing inside. */
function baseline(
  name: string,
  file: BaselineFile["file"] = {
    name: "Orbit",
    key: null,
  },
): BaselineFile {
  return {
    pixelwrightBaseline: 1,
    name,
    capturedAt: "2026-10-14T09:12:04.512Z",
    by: {
      server: "0.3.0",
      plugin: "0.3.0",
    },
    file,
    page: {
      id: "0:1",
      name: "Page 1",
    },
    node: {
      id: "1:1",
      name: "Pricing",
      type: "FRAME",
    },
    code: ["src/pricing.tsx"],
    version: null,
    snapshot: {
      root: {
        id: "1:1",
        name: "Pricing",
        type: "FRAME",
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        childCount: 0,
      },
      styles: {},
      variables: {},
    },
    tokens: null,
  };
}

const project = () => mkdtemp(join(tmpdir(), "pixelwright-baselines-"));

describe("folderBaselines", () => {
  it("writes compact JSON with its header first in the project's .pixelwright/baselines, and says when it made the folder", async () => {
    const root = await project();
    const store = folderBaselines(root);
    const first = await store.write(baseline("pricing"));
    const second = await store.write(baseline("checkout"));
    const text = await readFile(join(root, ".pixelwright", "baselines", "pricing.json"), "utf8");

    expect(first).toEqual({
      path: join(root, ".pixelwright", "baselines", "pricing.json"),
      madeFolder: true,
    });
    expect(second.madeFolder).toBe(false);
    expect(text.startsWith('{"pixelwrightBaseline":1,"name":"pricing","capturedAt"')).toBe(true);
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.split("\n")).toHaveLength(2);
    expect((await store.read("pricing"))?.code).toEqual(["src/pricing.tsx"]);
    expect(await store.read("missing")).toBeNull();
  });

  it("lists the baselines by name, an unreadable or newer one with why", async () => {
    const root = await project();
    const store = folderBaselines(root);

    await store.write(baseline("pricing"));
    await writeFile(join(store.folder(), "broken.json"), "{ not json");
    await writeFile(
      join(store.folder(), "future.json"),
      JSON.stringify({
        ...baseline("future"),
        pixelwrightBaseline: 2,
      }),
    );

    const listed = await store.list();

    expect(listed.map((entry) => [entry.name, "error" in entry ? entry.error : "ok"])).toEqual([
      ["broken", expect.stringContaining("JSON")],
      ["future", "saved by a newer Pixelwright: update it"],
      ["pricing", "ok"],
    ]);
    await expect(store.read("future")).rejects.toThrow(/future\.json cannot be read: saved by a newer Pixelwright/);
  });

  it("refuses the home folder and the disk's root, which are no project", () => {
    for (const root of [homedir(), "/"]) {
      expect(() => folderBaselines(root).folder()).toThrow(/is no project folder, so baselines have nowhere to live/);
    }
  });
});

describe("SeenDesigns", () => {
  it("keeps the last eight compared designs under random ids", () => {
    const seen = new SeenDesigns();
    const design = {
      name: "pricing",
      node: baseline("pricing").node,
      file: baseline("pricing").file,
      page: null,
      plugin: "0.3.0",
      snapshot: baseline("pricing").snapshot,
      tokens: null,
      capturedAt: "2026-10-14T10:00:00.000Z",
      baselineCapturedAt: "2026-10-14T09:12:04.512Z",
    };
    const ids = Array.from({ length: 9 }, () => seen.keep(design));

    expect(ids.every((id) => /^[0-9a-f]{16}$/.test(id))).toBe(true);
    expect(seen.get(ids[0] ?? "")).toBeUndefined();
    expect(seen.get(ids[8] ?? "")?.name).toBe("pricing");
  });
});

describe("baselineTarget", () => {
  const plugin = (session: string, name: string, key: string | null = null): ConnectedPlugin => ({
    session,
    info: pluginInfo({
      instanceId: session,
      file: {
        name,
        key,
      },
    }),
    active: false,
  });

  it("finds the file a baseline came from by key, else by name, and never the active file", () => {
    expect(baselineTarget([plugin("a", "Other"), plugin("b", "Orbit")], baseline("p"), undefined)).toEqual({
      session: "b",
      notes: [],
    });
    expect(
      baselineTarget(
        [plugin("a", "Orbit copy", "K1"), plugin("b", "Orbit")],
        baseline("p", {
          name: "Orbit",
          key: "K1",
        }),
        undefined,
      ).session,
    ).toBe("a");
    expect(() =>
      baselineTarget(
        [plugin("b", "Orbit")],
        baseline("p", {
          name: "Orbit",
          key: "K1",
        }),
        undefined,
      ),
    ).toThrow(/a copy shares the name, not the key/);
    expect(() => baselineTarget([plugin("a", "Orbit"), plugin("b", "Orbit")], baseline("p"), undefined)).toThrow(
      /Several connected files are named Orbit/,
    );
    expect(() => baselineTarget([plugin("a", "Other")], baseline("p"), undefined)).toThrow(
      /open Orbit in Figma Desktop with the Pixelwright plugin, or pass file if it was renamed/,
    );
  });

  it("compares in the file given, with a note when it is not the baseline's", () => {
    expect(baselineTarget([plugin("a", "Orbit v2")], baseline("p"), "Orbit v2")).toEqual({
      session: "a",
      notes: ["Compared in Orbit v2, not Orbit, which the baseline came from."],
    });
  });
});
