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

  it("accepts good XML in a dry run, saying how many elements it read", async () => {
    const answer = await tool().execute({ xml: "<Frame><Text>&mdash;</Text></Frame>", dryRun: true });

    expect(answer.structuredContent).toMatchObject({ dry: true, elements: 2 });
  });

  it("refuses a real run until the writing half lands", async () => {
    await expect(tool().execute({ xml: "<Frame/>" })).rejects.toMatchObject({ code: ERROR_CODE.opFailed });
  });
});
