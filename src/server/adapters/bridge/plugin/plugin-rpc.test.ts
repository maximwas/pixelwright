import { createBirpc } from "birpc";
import { describe, expect, it } from "vitest";
import { PluginRpc } from "@/server/adapters/bridge/plugin/plugin-rpc.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import type { PluginFunctions, ServerFunctions } from "@/shared/protocol/rpc.types.ts";

/** The server's PluginRpc wired to a plugin-side birpc that answers with `run`, frames passed as text both ways. */
const session = (run: PluginFunctions["run"]): PluginRpc => {
  let toPlugin: (text: string) => void = () => undefined;
  const rpc = new PluginRpc(
    { send: (text) => toPlugin(text), close: () => undefined },
    { pluginInfo: () => undefined },
  );

  createBirpc<ServerFunctions, PluginFunctions>(
    { run },
    {
      post: (text: string) => rpc.receive(text),
      on: (deliver: (text: string) => void) => {
        toPlugin = deliver;
      },
      serialize: (value: unknown) => JSON.stringify(value),
      deserialize: (text: string): unknown => JSON.parse(text),
    },
  );

  return rpc;
};

const answer: OpResult = { ok: true, data: { pong: true }, cuts: [], missing: [], touched: [] };

describe("PluginRpc (A§5.4)", () => {
  it("hands back the plugin's envelope as it came, for the plugin session to parse", async () => {
    const rpc = session(async () => answer);

    expect(await rpc.request("ping", {}, 5_000)).toEqual(answer);
  });

  it("fails every pending call PLUGIN_DISCONNECTED when the socket closes (S-009)", async () => {
    const rpc = session(() => new Promise(() => undefined));
    const pending = rpc.request("ping", {}, 5_000);

    // The call is on the wire before the socket closes, as in a real session.
    await new Promise((resolve) => setTimeout(resolve, 0));
    rpc.close();

    await expect(pending).rejects.toMatchObject({ code: "PLUGIN_DISCONNECTED" });
  });
});
