import { describe, expect, it } from "vitest";
import { replaceTexts } from "../src/features/texts-replace/replace-texts.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import { scopeBridge } from "./helpers/scope-bridge.ts";

const CHANGED = {
  changed: [
    {
      id: "1:2",
      name: "Title",
      before: "Sign in",
      after: "Log in",
      count: 1,
    },
  ],
  texts: 1,
  count: 1,
  errors: [],
  more: false,
};

const call = (view: ReturnType<typeof scopeBridge>, args: Partial<Parameters<typeof replaceTexts>[1]> = {}) =>
  replaceTexts(new PluginClient(view.bridge), {
    replacements: [
      {
        find: "Sign in",
        replace: "Log in",
        regex: false,
        caseSensitive: false,
        wholeWord: false,
      },
    ],
    dryRun: false,
    ...args,
  });

describe("texts_replace", () => {
  it("replaces under the selected layers and says how much in a sentence", async () => {
    const view = scopeBridge({
      selection: ["1:1"],
      answers: { texts: CHANGED },
    });
    const result = await call(view);

    expect(view.inputs.texts).toMatchObject({ roots: ["1:1"] });
    expect(result.summary).toBe("Replaced 1 match in 1 text under the selection.");
  });

  it("goes through the whole file when asked", async () => {
    const view = scopeBridge({
      selection: [],
      answers: { texts: CHANGED },
    });

    await call(view, { within: "file" });

    expect(view.inputs.texts).toMatchObject({ roots: ["0:1"] });
  });

  it("saves a version only before a write that changes texts", async () => {
    const changing = scopeBridge({
      selection: ["1:1"],
      answers: { texts: CHANGED },
    });

    await call(changing, { version: "Before the copy edit" });
    expect(changing.asked).toEqual(["selection", "texts (dry run)", "save_version", "texts"]);

    const idle = scopeBridge({
      selection: ["1:1"],
      answers: {
        texts: {
          ...CHANGED,
          changed: [],
          texts: 0,
          count: 0,
        },
      },
    });
    const result = await call(idle, { version: "x" });

    expect(idle.asked).toEqual(["selection", "texts (dry run)"]);
    expect(result.summary).toBe("Would replace 0 matches in 0 texts under the selection.");
  });
});
