import { expect, it } from "vitest";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import { ToolCatalog } from "@/server/tools/tool.catalog.ts";

// D-41, T-143: a tool that writes extends WriteTool, takes `version` and leaves run() to it, so no writer can skip the
// versioned path. version_save alone saves its version itself (T-180).
it("runs every writer through WriteTool's versioned path", async () => {
  const bypassing: string[] = [];

  for (const manifest of new ToolCatalog().manifests().filter(({ annotations }) => !annotations.readOnlyHint)) {
    const tool = await manifest.load();
    const versioned =
      tool.prototype instanceof WriteTool && "version" in manifest.input.shape && !Object.hasOwn(tool.prototype, "run");

    if (!versioned) {
      bypassing.push(manifest.name);
    }
  }

  expect(bypassing).toEqual(["version_save"]);
});
