import { expect, it } from "vitest";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import { ToolCatalog } from "@/server/tools/tool.catalog.ts";

// D-41, T-143: a tool that writes extends WriteTool, takes `version` and leaves run() to it, so no writer can skip the
// versioned path. version_save alone saves its version itself (T-180).
it("runs every writer through WriteTool's versioned path", async () => {
  const bypassing: string[] = [];

  for (const manifest of new ToolCatalog().manifests()) {
    const tool = await manifest.load();
    const isWriteTool = tool.prototype instanceof WriteTool;
    const versioned = isWriteTool && "version" in manifest.input.shape && !Object.hasOwn(tool.prototype, "run");
    // A tool that writes, or takes `version`, cannot hide behind a read-only annotation.
    const writes = !manifest.annotations.readOnlyHint || isWriteTool || "version" in manifest.input.shape;
    const contradicts = isWriteTool && (manifest.annotations.readOnlyHint ?? false);

    if ((writes && !versioned) || contradicts) {
      bypassing.push(manifest.name);
    }
  }

  expect(bypassing).toEqual(["version_save"]);
});
