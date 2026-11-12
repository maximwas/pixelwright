import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ToolCatalog } from "@/server/tools/tool.catalog.ts";
import { AnswerTypes } from "./answer-types.ts";

const WRITTEN: { tool: string; call: string; type: string }[] = JSON.parse(
  readFileSync(new URL("../../src/server/tools/types-read/data/answer-types.json", import.meta.url), "utf8"),
);

describe("answer-types.json", () => {
  // types_read answers from this file, written at build time: a schema changed without `pnpm build:pw` would give
  // scripts the answer types the tools no longer have.
  it("holds every read's answer type as the tool manifests declare it today", async () => {
    expect(WRITTEN).toEqual(await new AnswerTypes().entries());
  }, 60_000);

  it("covers every tool a script can call, and only those", () => {
    expect(WRITTEN.map(({ tool }) => tool)).toEqual(new ToolCatalog().reads().map(({ name }) => name));
  });
});
