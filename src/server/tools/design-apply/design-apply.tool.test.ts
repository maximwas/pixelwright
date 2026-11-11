import { describe, expect, it } from "vitest";
import type { ApplyChange } from "@/core/apply/apply.types.ts";
import type { WritePlanner } from "@/core/apply/plan/write-planner.ts";
import { DesignApplyTool } from "@/server/tools/design-apply/design-apply.tool.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";

// Without ids to read the plugin is never reached, so the collaborators are never called.
function tool(planner = {} as WritePlanner, session = {}): DesignApplyTool {
  return new DesignApplyTool(session as never, {} as never, {} as never, planner);
}

const IDLE = { layersToRead: () => [], plan: () => ({ changes: [], written: [], send: [], errors: [] }) } as never;

describe("DesignApplyTool", () => {
  it("answers INVALID_XML with the line, the column and the words", async () => {
    await expect(tool().execute({ xml: "<Frame>\n  <Text>Hi</Frame>", dryRun: true })).rejects.toMatchObject({
      code: ERROR_CODE.invalidXml,
      message: expect.stringContaining("line 2, column 11: Expected </Text> for the tag at line 2, found </Frame>."),
    });
  });

  it("answers a dry run with the elements it read and every refusal", async () => {
    const answer = await tool(IDLE).execute({ xml: '<Frame><Text x="10">&mdash;</Text></Frame>', dryRun: true });
    const content = answer.structuredContent as {
      elements: { tag: string; ref: string }[];
      errors: { attribute?: string }[];
    };

    expect(content).toMatchObject({ dry: true });
    expect(content.elements.map(({ tag, ref }) => [tag, ref])).toEqual([
      ["Frame", "new:1"],
      ["Text", "new:1:8"],
    ]);
    expect(content.errors.map(({ attribute }) => attribute)).toEqual(["x"]);
  });

  // Item 34: a dry run reads the named layers with the apply profile and lists the changes the plan makes.
  it("reads the named layers with the apply profile and lists what the plan changes", async () => {
    const asked: unknown[] = [];
    const session = {
      run: async (_op: unknown, input: unknown) => {
        asked.push(input);

        return { reads: [], missing: [], cuts: [] };
      },
    };
    const layout: ApplyChange = {
      line: 1,
      column: 1,
      kind: "update",
      ref: "81:1",
      id: "81:1",
      tag: "Frame",
      parent: null,
      index: 0,
      props: { itemSpacing: 12 },
      sources: { itemSpacing: "gap" },
    };
    const planner = {
      layersToRead: () => ["81:1"],
      plan: () => ({ changes: [layout], written: [layout], send: [layout], errors: [] }),
    } as never;
    const answer = await tool(planner, session).execute({ xml: '<Frame id="81:1" gap="12px"/>', dryRun: true });

    expect(asked).toEqual([{ nodes: ["81:1"], profile: "apply" }]);
    expect(answer.structuredContent).toMatchObject({
      dry: true,
      changes: [{ id: "81:1", tag: "Frame", kind: "update", props: { itemSpacing: 12 } }],
    });
  });

  it("refuses a real run until the writing half lands", async () => {
    await expect(tool(IDLE).execute({ xml: "<Frame/>" })).rejects.toMatchObject({ code: ERROR_CODE.opFailed });
  });
});
