import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectFolder } from "@/server/app/project/project-folder.ts";
import { BaselineStore } from "@/server/app/stores/baseline-store.ts";
import { editedPricing, rawTokensOf, withIconPaths } from "./support/baseline-edits.ts";
import { baselines, fixture } from "./support/design-classes.ts";

// 0.7.0's golden, byte for byte: Orbit's pricing page with illustrative edits since its baseline (T-205, K-055..K-057).
describe("golden baseline diff", () => {
  it("keeps what changed on Orbit's pricing page since its baseline, list by list", async () => {
    const before = withIconPaths(fixture("orbit-pricing"), "v1");
    const after = editedPricing(before);
    const result = baselines.compare(
      { snapshot: before, tokens: rawTokensOf(before) },
      { snapshot: after, tokens: rawTokensOf(after) },
      true,
    );

    await expect(`${JSON.stringify(result, null, 2)}\n`).toMatchFileSnapshot("__golden__/baseline-diff.orbit.json");
  });
});

// The baseline 0.7.0 kept of Orbit's Plans (server 0.2.0, plugin 0.3.0), as a project commits it: format 1 stays (D-33).
describe("a baseline 0.7.0 wrote", () => {
  it("reads as format 1 with its header, the layer's read and the tokens it uses (D-33, K-058)", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixelwright-golden-baselines-"));
    const folder = join(root, ".pixelwright", "baselines");

    try {
      await mkdir(folder, { recursive: true });
      await copyFile(new URL("fixtures/baseline-plans-0.7.0.json", import.meta.url), join(folder, "plans.json"));

      const file = await new BaselineStore(new ProjectFolder({ uris: async () => [] }, root)).read("plans");

      expect(file).toMatchObject({
        pixelwrightBaseline: 1,
        name: "plans",
        capturedAt: "2026-10-15T05:54:12.660Z",
        by: { server: "0.2.0", plugin: "0.3.0" },
        file: { name: "Test MCP", key: null },
        page: { id: "54:226", name: "Orbit — Pricing" },
        node: { id: "54:243", name: "Plans", type: "FRAME" },
        code: ["src/components/PlanCard.tsx", "src/pages/Pricing.tsx"],
        version: null,
      });
      expect(file?.snapshot.root.id).toBe("54:243");
      expect(Object.keys(file?.snapshot.variables ?? {})).toHaveLength(15);
      expect(file?.tokens?.variables).toHaveLength(15);
      expect(file?.tokens?.styles).toHaveLength(7);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
