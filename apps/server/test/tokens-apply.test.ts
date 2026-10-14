import { describe, expect, it } from "vitest";
import { applyTokens } from "../src/tokens/tokens.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A plugin that saves versions (refusing one named "fails") and writes whatever tokens it is given. */
function plugin() {
  const ops: string[] = [];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo(),
        active: true,
      },
    ],
    request: async (op, input) => {
      ops.push(op);

      if (op === "save_version") {
        if ((input as { title: string }).title === "fails") {
          throw new Error("Figma refused the version");
        }

        return { id: "v-7" };
      }

      return {
        created: [],
        updated: [],
        errors: [],
      };
    },
  };

  return {
    bridge,
    ops,
  };
}

const TOKENS = {
  collections: [
    {
      name: "Orbit",
      variables: [
        {
          name: "color/brand",
          values: { Light: "#3B2FD9" },
        },
      ],
    },
  ],
  styles: {
    paint: [],
    text: [],
    effect: [],
  },
};

describe("tokens_apply with a version", () => {
  it("saves it before writing, never in a dry run, and writes nothing when the save fails", async () => {
    const written = plugin();
    const result = await applyTokens(written.bridge, {
      ...TOKENS,
      dryRun: false,
      version: "Before the brand change",
    });

    expect(written.ops).toEqual(["save_version", "tokens_apply"]);
    expect(result.version).toEqual({
      id: "v-7",
      title: "Before the brand change",
    });

    const checked = plugin();

    await applyTokens(checked.bridge, {
      ...TOKENS,
      dryRun: true,
      version: "Before the brand change",
    });
    expect(checked.ops).toEqual(["tokens_apply"]);

    const refused = plugin();

    await expect(
      applyTokens(refused.bridge, {
        ...TOKENS,
        dryRun: false,
        version: "fails",
      }),
    ).rejects.toThrow(/The version "fails" could not be saved, so nothing was written/);
    expect(refused.ops).toEqual(["save_version"]);
  });
});
