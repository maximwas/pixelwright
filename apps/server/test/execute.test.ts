import { describe, expect, it } from "vitest";
import { executeCode } from "../src/features/execute/execute-code.ts";
import { ExecuteInputSchema } from "../src/features/execute/schemas.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { RequestOptions } from "../src/types/bridge.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A bridge that records what it is asked and answers each operation from `answers`. */
function recording(answers: Record<string, unknown>) {
  const asked: { op: string; input: unknown; options: RequestOptions | undefined }[] = [];
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
    request: async (op, input, options) => {
      asked.push({
        op,
        input,
        options,
      });

      return answers[op];
    },
  };

  return {
    asked,
    client: new PluginClient(bridge),
  };
}

const RAN = {
  result: 42,
  logs: ["hi"],
};

describe("execute", () => {
  it("runs the code in the plugin with its timeout in milliseconds and returns what came back", async () => {
    const { asked, client } = recording({ execute: RAN });

    expect(
      await executeCode(
        client,
        ExecuteInputSchema.parse({
          code: "return 42;",
          timeout: 3,
        }),
      ),
    ).toEqual(RAN);
    expect(
      asked.map(({ op, input }) => ({
        op,
        input,
      })),
    ).toEqual([
      {
        op: "execute",
        input: {
          code: "return 42;",
          timeoutMs: 3_000,
        },
      },
    ]);
  });

  it("waits for the plugin a little past the code's time, however long it is", async () => {
    const { asked, client } = recording({ execute: RAN });

    await executeCode(
      client,
      ExecuteInputSchema.parse({
        code: "x",
        timeout: 120,
      }),
    );

    expect(asked[0]).toMatchObject({
      input: { timeoutMs: 120_000 },
      options: { timeoutMs: 125_000 },
    });
  });

  it("takes up to five minutes, ten seconds by default", () => {
    expect(
      ExecuteInputSchema.safeParse({
        code: "x",
        timeout: 300,
      }).success,
    ).toBe(true);
    expect(
      ExecuteInputSchema.safeParse({
        code: "x",
        timeout: 301,
      }).success,
    ).toBe(false);
    expect(ExecuteInputSchema.parse({ code: "x" }).timeout).toBe(10);
  });

  it("saves a named version in the file's history before the code runs", async () => {
    const { asked, client } = recording({
      save_version: { id: "v7" },
      execute: RAN,
    });

    expect(
      await executeCode(
        client,
        ExecuteInputSchema.parse({
          code: "x",
          version: "Before the bulk rename",
        }),
      ),
    ).toEqual({
      ...RAN,
      version: {
        id: "v7",
        title: "Before the bulk rename",
      },
    });
    expect(asked.map(({ op }) => op)).toEqual(["save_version", "execute"]);
  });
});
