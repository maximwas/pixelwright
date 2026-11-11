import { describe, expect, it } from "vitest";
import { DesignApplyTool } from "@/server/tools/design-apply/design-apply.tool.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";

// Item 32: prepare only parses. No plugin is reached, so the collaborators are never called.
function tool(): DesignApplyTool {
  return new DesignApplyTool({} as never, {} as never, {} as never);
}

describe("DesignApplyTool", () => {
  it("answers INVALID_XML with the line, the column and the words", async () => {
    await expect(tool().execute({ xml: "<Frame>\n  <Text>Hi</Frame>", dryRun: true })).rejects.toMatchObject({
      code: ERROR_CODE.invalidXml,
      message: expect.stringContaining("line 2, column 11: Expected </Text> for the tag at line 2, found </Frame>."),
    });
  });

  it("answers a dry run with the elements it read and every refusal", async () => {
    const answer = await tool().execute({ xml: '<Frame><Text x="10">&mdash;</Text></Frame>', dryRun: true });
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

  it("refuses a real run until the writing half lands", async () => {
    await expect(tool().execute({ xml: "<Frame/>" })).rejects.toMatchObject({ code: ERROR_CODE.opFailed });
  });
});
