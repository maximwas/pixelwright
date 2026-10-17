import { describe, expect, it } from "vitest";
import { reattachInstances } from "../src/features/instances-reattach/reattach-instances.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import { scopeBridge } from "./helpers/scope-bridge.ts";

const DONE = {
  reattached: [
    {
      frame: "1:1",
      name: "Card",
      instance: "9:1",
      component: "Card",
      kept: ["text Title"],
      lost: [],
    },
  ],
  swapped: [],
  reset: [],
  errors: [],
  notes: [],
  more: false,
};

const call = (view: ReturnType<typeof scopeBridge>, args: Partial<Parameters<typeof reattachInstances>[1]> = {}) =>
  reattachInstances(new PluginClient(view.bridge), {
    swap: [],
    dryRun: false,
    ...args,
  });

describe("instances_reattach", () => {
  it("puts detached frames back unless another action is asked for", async () => {
    const view = scopeBridge({
      selection: ["1:0"],
      answers: { instances: DONE },
    });
    const result = await call(view);

    expect(view.inputs.instances).toMatchObject({
      roots: ["1:0"],
      reattach: true,
      swap: [],
    });
    expect(result.summary).toBe("Put 1 detached frame back as an instance.");

    await call(view, { reset: "look" });

    expect(view.inputs.instances).toMatchObject({
      reattach: false,
      reset: "look",
    });
  });

  it("saves a version only before a write that changes layers", async () => {
    const view = scopeBridge({
      selection: ["1:0"],
      answers: { instances: DONE },
    });

    await call(view, { version: "Before reattaching" });

    expect(view.asked).toEqual(["selection", "instances (dry run)", "save_version", "instances"]);
  });

  it("says when there was nothing to change", async () => {
    const view = scopeBridge({
      selection: ["1:0"],
      answers: {
        instances: {
          ...DONE,
          reattached: [],
        },
      },
    });

    expect((await call(view, { version: "x" })).summary).toBe("Nothing to change here.");
    expect(view.asked).toEqual(["selection", "instances (dry run)"]);
  });
});
