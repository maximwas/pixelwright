import { createBirpc } from "birpc";
import { describe, expect, it } from "vitest";
import { PluginRpc } from "@/server/adapters/bridge/plugin-rpc/plugin-rpc.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { pingOp } from "@/shared/ops/ping/ping.manifest.ts";
import type { PluginFunctions, ServerFunctions } from "@/shared/protocol/rpc.types.ts";

/** The server's PluginRpc wired to a plugin-side birpc that answers with `run`, frames passed as text both ways. */
const session = (run: PluginFunctions["run"]): PluginRpc => {
  let toPlugin: (text: string) => void = () => undefined;
  const rpc = new PluginRpc({
    send: (text) => toPlugin(text),
    close: () => undefined,
  });

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

const answer = (data: unknown): OpResult => ({
  ok: true,
  data,
  cuts: [],
  missing: [],
  touched: [],
});

describe("PluginRpc (A§5.4)", () => {
  it("runs an op in the plugin and gives its data, parsed with the op's output schema", async () => {
    const rpc = session(async (op) => answer(op === "ping" ? { pong: true } : null));

    expect(await rpc.run(pingOp, {})).toEqual({ pong: true });
  });

  it("turns the plugin's failure into a PixelwrightError with its code", async () => {
    const rpc = session(async () => ({
      ok: false,
      error: {
        code: "EDITS_DISABLED",
        message: "Allow edits is off",
      },
    }));

    await expect(rpc.run(pingOp, {})).rejects.toMatchObject({
      code: "EDITS_DISABLED",
      message: "Allow edits is off",
    });
  });

  it("refuses data that does not match the op's output (T-002)", async () => {
    const rpc = session(async () => answer({ pong: false }));

    await expect(rpc.run(pingOp, {})).rejects.toMatchObject({ code: "OP_FAILED" });
  });

  it("fails every pending call PLUGIN_DISCONNECTED when the socket closes (S-009)", async () => {
    const rpc = session(() => new Promise(() => undefined));
    const pending = rpc.run(pingOp, {});

    // The call is on the wire before the socket closes, as in a real session.
    await new Promise((resolve) => setTimeout(resolve, 0));
    rpc.close();

    await expect(pending).rejects.toMatchObject({ code: "PLUGIN_DISCONNECTED" });
  });
});
