import { describe, expect, it } from "vitest";
import { setEditsAllowed } from "../src/figma/edits.ts";
import { runOperation } from "../src/figma/operations.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

describe("save_version", () => {
  it("saves a named version in the file's history, and only with Allow edits on", async () => {
    const { figma } = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
      }),
    );
    const saved: string[] = [];

    Object.assign(figma, {
      saveVersionHistoryAsync: async (title: string) => {
        saved.push(title);

        return { id: "v-42" };
      },
    });

    setEditsAllowed(false);
    await expect(runOperation("save_version", { title: "Before hero" })).rejects.toMatchObject({
      code: "EDITS_DISABLED",
    });
    expect(saved).toEqual([]);

    setEditsAllowed(true);
    expect(await runOperation("save_version", { title: "Before hero" })).toEqual({ id: "v-42" });
    expect(saved).toEqual(["Before hero"]);
    setEditsAllowed(false);
  });
});
