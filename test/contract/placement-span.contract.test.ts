import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SHARED_COPY = "@/core/kernel/geometry/placement-span.ts";
const PLUGIN = "src/plugin";

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);

    return entry.isDirectory() ? sources(path) : entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("placement spans", () => {
  // C-053: 0.7.0 kept the span arithmetic twice, in core and again in the plugin; the rewrite keeps one copy in core
  // that the plugin imports. A plugin file that reads an axis placement's kind without importing it has its own copy.
  it("have one copy, in core, that the plugin imports", () => {
    expect(existsSync(SHARED_COPY.replace("@/", "src/"))).toBe(true);

    const ownCopies = sources(PLUGIN).filter((path) => {
      const text = readFileSync(path, "utf8");

      return (
        (text.includes("INTENT_AXIS") || /\bplacementSpan\b|class PlacementSpan/.test(text)) &&
        !text.includes(SHARED_COPY)
      );
    });

    expect(ownCopies).toEqual([]);
  });
});
