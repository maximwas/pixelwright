import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BaselineStore } from "@/server/app/baselines/baseline-store.ts";
import type { BaselineFile } from "@/server/app/baselines/baselines.schema.ts";
import { ProjectFolder } from "@/server/app/project/project-folder.ts";

const projects: string[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A store over a fresh temp project folder, never the repo (m:335a001e), and the folder its baselines go to. */
async function project(): Promise<{ store: BaselineStore; folder: string }> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-baselines-"));

  projects.push(root);

  return {
    store: new BaselineStore(new ProjectFolder({ uris: async () => [] }, root)),
    folder: join(root, ".pixelwright", "baselines"),
  };
}

/** A baseline as baseline_save writes it, of a frame with nothing inside. */
function baseline(name: string): BaselineFile {
  return {
    pixelwrightBaseline: 1,
    name,
    capturedAt: "2026-11-04T09:12:04.512Z",
    by: { server: "0.8.0", plugin: "0.8.0" },
    file: { name: "Test MCP", key: null },
    page: { id: "0:1", name: "Start here" },
    node: { id: "1:1", name: "Pricing", type: "FRAME" },
    code: ["src/pricing.tsx"],
    version: null,
    snapshot: {
      model: 1,
      profile: "design",
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

describe("the baseline store", () => {
  it("writes compact JSON, header first, in the project's .pixelwright/baselines, says when it made the folder, and reads it back (T-200, K-058)", async () => {
    const { store, folder } = await project();
    const first = await store.write(baseline("pricing"));
    const second = await store.write(baseline("checkout"));
    const text = await readFile(join(folder, "pricing.json"), "utf8");

    expect(first).toEqual({ path: join(folder, "pricing.json"), madeFolder: true });
    expect(second.madeFolder).toBe(false);
    expect(text.startsWith('{"pixelwrightBaseline":1,"name":"pricing","capturedAt"')).toBe(true);
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.split("\n")).toHaveLength(2);
    expect((await store.read("pricing"))?.code).toEqual(["src/pricing.tsx"]);
    expect(await store.read("missing")).toBeNull();
  });

  it("goes by the file's name, never the name inside it, and writes only under a baseline name (T-200)", async () => {
    const { store, folder } = await project();

    await store.write(baseline("pricing"));
    await writeFile(join(folder, "plans.json"), JSON.stringify(baseline("pricing")));
    await writeFile(join(folder, "odd.json"), JSON.stringify(baseline("../../package")));

    const plans = await store.read("plans");

    expect(plans?.name).toBe("plans");
    expect((await store.read("odd"))?.name).toBe("odd");

    if (plans !== null) {
      await store.write({ ...plans, code: ["src/plans.tsx"] });
    }

    expect((await store.read("pricing"))?.code).toEqual(["src/pricing.tsx"]);
    expect((await store.read("plans"))?.code).toEqual(["src/plans.tsx"]);
    await expect(store.write(baseline("../../package"))).rejects.toThrow(
      '"../../package" is not a baseline name (pricing, plan-card).',
    );
  });

  it("names the file it cannot read: not JSON, or a format a newer Pixelwright wrote (K-058)", async () => {
    const { store, folder } = await project();

    await store.write(baseline("pricing"));
    await writeFile(join(folder, "broken.json"), "{ not json");
    await writeFile(join(folder, "future.json"), JSON.stringify({ ...baseline("future"), pixelwrightBaseline: 2 }));

    await expect(store.read("broken")).rejects.toThrow(/broken\.json cannot be read: /);
    await expect(store.read("future")).rejects.toThrow(
      `${join(folder, "future.json")} cannot be read: saved by a newer Pixelwright: update it`,
    );
  });

  it.each([homedir(), "/"])("refuses %s as the project, which is no project (T-200)", async (root) => {
    const store = new BaselineStore(new ProjectFolder({ uris: async () => [] }, root));

    await expect(store.root()).rejects.toThrow(
      `${root} is no project folder, so baselines have nowhere to live: start the MCP client in the project, or set CLAUDE_PROJECT_DIR.`,
    );
  });
});
