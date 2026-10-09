import { describe, expect, it } from "vitest";
import { executeCode } from "../src/mcp/tools/execute.ts";
import { ExecuteInputSchema } from "../src/schemas/tools.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

describe("execute", () => {
  it("runs the code in the plugin with its timeout in milliseconds and returns what came back", async () => {
    const asked: { op: string; input: unknown }[] = [];
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
        asked.push({
          op,
          input,
        });

        return {
          result: 42,
          logs: ["hi"],
        };
      },
    };

    expect(
      await executeCode(
        bridge,
        ExecuteInputSchema.parse({
          code: "return 42;",
          timeout: 3,
        }),
      ),
    ).toEqual({
      result: 42,
      logs: ["hi"],
    });
    expect(asked).toEqual([
      {
        op: "execute",
        input: {
          code: "return 42;",
          timeoutMs: 3_000,
        },
      },
    ]);
  });

  it("takes at most 25 seconds, so the plugin answers before the bridge gives up", () => {
    expect(
      ExecuteInputSchema.safeParse({
        code: "x",
        timeout: 26,
      }).success,
    ).toBe(false);
    expect(ExecuteInputSchema.parse({ code: "x" }).timeout).toBe(10);
  });
});
