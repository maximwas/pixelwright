import { describe, expect, it } from "vitest";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

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

    plugin.services.edits.allow(false);
    await expect(plugin.run("save_version", { title: "Before hero" })).rejects.toMatchObject({
      code: "EDITS_DISABLED",
    });
    expect(saved).toEqual([]);

    plugin.services.edits.allow(true);
    expect(await plugin.run("save_version", { title: "Before hero" })).toEqual({ id: "v-42" });
    expect(saved).toEqual(["Before hero"]);
    plugin.services.edits.allow(false);
  });
});
