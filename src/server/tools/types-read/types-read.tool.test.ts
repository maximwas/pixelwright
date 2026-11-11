import { describe, expect, it } from "vitest";
import { TypesReadTool } from "@/server/tools/types-read/types-read.tool.ts";

describe("TypesReadTool", () => {
  it("answers each read's whole answer type by its tool or pw name, and lists the names it does not know", async () => {
    const answer = await new TypesReadTool().execute({ tools: ["nodes_find", "designRead", "execute", "nope"] });
    const { types, unknown } = answer.structuredContent as {
      types: { tool: string; call: string; type: string }[];
      unknown: string[];
    };

    expect(types.map(({ tool, call }) => [tool, call])).toEqual([
      ["nodes_find", "pw.nodesFind"],
      ["design_read", "pw.designRead"],
    ]);
    expect(types[0]?.type).toContain("export interface NodesFindResult");
    expect(types[1]?.type).toContain("tree: DesignElement | null");
    expect(unknown).toEqual(["execute", "nope"]);
  });
});
