import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectFolder } from "@/server/app/project/project-folder.ts";
import { BaselineStore } from "@/server/app/stores/baseline-store.ts";

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
