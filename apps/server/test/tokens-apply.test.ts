import { describe, expect, it } from "vitest";
import { applyTokens } from "../src/features/tokens-apply/apply-tokens.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/**
 * A plugin that saves versions (refusing one named "fails") and, for any tokens, makes one variable unless `writes` is
 * false (the file holds them already). Each request is recorded by its operation, a dry run said so.
 */
function plugin({ writes = true }: { writes?: boolean } = {}) {
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
      ops.push((input as { dryRun?: boolean }).dryRun ? `${op} (dry run)` : op);

      if (op === "save_version") {
        if ((input as { title: string }).title === "fails") {
          throw new Error("Figma refused the version");
        }

        return { id: "v-7" };
      }

      return {
        created: writes
          ? [
              {
                kind: "variable",
                name: "color/brand",
                collection: "Orbit",
              },
            ]
          : [],
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
    const result = await applyTokens(new PluginClient(written.bridge), {
      ...TOKENS,
      dryRun: false,
      version: "Before the brand change",
    });

    // A dry run first says whether anything will be written; the version is saved only then, before the write.
    expect(written.ops).toEqual(["tokens_apply (dry run)", "save_version", "tokens_apply"]);
    expect(result.version).toEqual({
      id: "v-7",
      title: "Before the brand change",
    });

    const checked = plugin();

    await applyTokens(new PluginClient(checked.bridge), {
      ...TOKENS,
      dryRun: true,
      version: "Before the brand change",
    });
    expect(checked.ops).toEqual(["tokens_apply (dry run)"]);

    const refused = plugin();

    await expect(
      applyTokens(new PluginClient(refused.bridge), {
        ...TOKENS,
        dryRun: false,
        version: "fails",
      }),
    ).rejects.toThrow(/The version "fails" could not be saved, so nothing was written/);
    expect(refused.ops).toEqual(["tokens_apply (dry run)", "save_version"]);
  });

  it("saves no version when the file holds every token already, and writes nothing", async () => {
    const held = plugin({ writes: false });
    const result = await applyTokens(new PluginClient(held.bridge), {
      ...TOKENS,
      dryRun: false,
      version: "Before the brand change",
    });

    expect(held.ops).toEqual(["tokens_apply (dry run)"]);
    expect(result).toEqual({
      created: [],
      updated: [],
      errors: [],
      dryRun: false,
    });
  });

  it("asks for no dry run first when no version is wanted", async () => {
    const plain = plugin();

    await applyTokens(new PluginClient(plain.bridge), {
      ...TOKENS,
      dryRun: false,
    });

    expect(plain.ops).toEqual(["tokens_apply"]);
  });
});
