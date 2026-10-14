import { describe, expect, it } from "vitest";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** Two connected files, Orbit (active) and Brand; every request is recorded and answered with `answer`. */
function bridgeAnswering(answer: unknown) {
  const requests: { op: string; input: unknown; session: string | undefined }[] = [];
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
      {
        session: "s2",
        info: pluginInfo({
          file: {
            name: "Brand",
            key: null,
          },
        }),
        active: false,
      },
    ],
    request: async (op, input, options) => {
      requests.push({
        op,
        input,
        session: options?.session,
      });

      return answer;
    },
  };

  return {
    client: new PluginClient(bridge),
    requests,
  };
}

describe("PluginClient", () => {
  it("runs an operation on the active file and returns the answer its schema reads", async () => {
    const { client, requests } = bridgeAnswering({ pong: true });

    await expect(client.run("ping", {})).resolves.toEqual({ pong: true });
    expect(requests).toEqual([
      {
        op: "ping",
        input: {},
        session: "s1",
      },
    ]);
  });

  it("runs it on the file a tool names", async () => {
    const { client, requests } = bridgeAnswering({ pong: true });

    await client.run("ping", {}, "brand");

    expect(requests[0]?.session).toBe("s2");
  });

  it("refuses an answer that is not what the operation returns", async () => {
    const { client } = bridgeAnswering({ pong: "maybe" });

    await expect(client.run("ping", {})).rejects.toThrow();
  });
});
