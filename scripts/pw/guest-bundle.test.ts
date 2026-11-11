import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { GUEST } from "@/server/adapters/sandbox/guest/guest.constants.ts";
import { TOOL_JSON_SCHEMA } from "@/server/main/mcp/mcp.constants.ts";
import { ToolCatalog } from "@/server/tools/tool.catalog.ts";
import { GuestBundle } from "./guest-bundle.ts";

const WRITTEN: { source: string } = JSON.parse(
  readFileSync(new URL("../../src/server/adapters/sandbox/data/pw-utils.json", import.meta.url), "utf8"),
);

describe("pw-utils.json", () => {
  // The sandbox evaluates the bundle, not the guest's TypeScript: a guest changed without `pnpm build:pw` runs stale.
  it("holds the guest's utils as esbuild bundles them today", async () => {
    expect(WRITTEN.source).toBe(await new GuestBundle().source());
  });

  // utils.layers asks inspect for one batch at a time: past inspect's own maximum, every batch would be refused.
  it("batches inspect by the most ids its input schema takes", () => {
    const inspect = new ToolCatalog().reads().find(({ name }) => name === "inspect");
    const input = zod.toJSONSchema(inspect?.input ?? zod.object({}), {
      target: TOOL_JSON_SCHEMA.target,
      io: TOOL_JSON_SCHEMA.input,
    }) as { properties?: { nodes?: { maxItems?: number } } };

    expect(input.properties?.nodes?.maxItems).toBe(GUEST.inspectBatch);
  });
});
