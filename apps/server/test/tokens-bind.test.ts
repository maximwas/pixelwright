import { describe, expect, it } from "vitest";
import { bindTokens } from "../src/features/tokens-bind/bind-tokens.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BindView } from "./helpers/scope-bridge.ts";
import { scopeBridge } from "./helpers/scope-bridge.ts";

const BOUND = {
  bound: [
    {
      kind: "color",
      field: "background",
      value: "#FFF",
      token: "--surface",
      count: 3,
      examples: ["1:2"],
    },
  ],
  ambiguous: [],
  unmatched: [
    {
      kind: "number",
      field: "gap",
      value: "13px",
      count: 1,
      examples: ["1:3"],
    },
  ],
  remapped: [],
  layers: 2,
  errors: [],
  notes: [],
  more: false,
};

const call = (view: BindView, args: Partial<Parameters<typeof bindTokens>[1]> = {}) =>
  bindTokens(new PluginClient(view.bridge), {
    kinds: ["color", "number", "text", "effect"],
    choose: [],
    remap: [],
    dryRun: false,
    ...args,
  });

describe("tokens_bind: where it binds", () => {
  it("binds under the selected layers, and says what it did in a sentence", async () => {
    const view = scopeBridge({
      selection: ["1:1", "1:5"],
      answers: { bind: BOUND },
    });
    const result = await call(view);

    expect(view.asked).toEqual(["selection", "bind"]);
    expect(view.inputs.bind).toMatchObject({
      roots: ["1:1", "1:5"],
      dryRun: false,
    });
    expect(result.summary).toBe("Bound 3 raw values to tokens on 2 layers; 1 value has no token.");
  });

  it("refuses a write with nothing selected, naming within", async () => {
    await expect(call(scopeBridge({ selection: [] }))).rejects.toThrow(/select layers, or give within/);
  });

  it("binds a whole page by its id", async () => {
    const view = scopeBridge({
      selection: [],
      answers: { bind: BOUND },
    });

    await call(view, { within: "0:1" });

    expect(view.inputs.bind).toMatchObject({ roots: ["0:1"] });
  });
});

describe("tokens_bind: the version before the write", () => {
  it("saves a named version only after a dry run says the write changes layers", async () => {
    const view = scopeBridge({
      selection: ["1:1"],
      answers: { bind: BOUND },
    });
    const result = await call(view, { version: "Before binding" });

    expect(view.asked).toEqual(["selection", "bind (dry run)", "save_version", "bind"]);
    expect(result.version).toEqual({
      id: "v-1",
      title: "Before binding",
    });
  });

  it("saves none when nothing would change", async () => {
    const view = scopeBridge({
      selection: ["1:1"],
      answers: {
        bind: {
          ...BOUND,
          bound: [],
          layers: 0,
        },
      },
    });
    const result = await call(view, { version: "x" });

    expect(view.asked).toEqual(["selection", "bind (dry run)"]);
    expect(result.summary).toBe("Would bind 0 raw values to tokens on 0 layers; 1 value has no token.");
  });
});
