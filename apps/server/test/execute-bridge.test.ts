import { BRIDGE_PATH, EXECUTE_CODE_CHARS, OPERATION_SCHEMAS } from "@pixelwright/core";
import { afterEach, describe, expect, it } from "vitest";
import { SocketLink } from "../../plugin/src/link/socket-link.ts";
import type { SocketLike } from "../../plugin/src/types/link.ts";
import { BridgeServer } from "../src/bridge/bridge-server.ts";
import { executeCode } from "../src/features/execute/execute-code.ts";
import { ExecuteInputSchema } from "../src/features/execute/schemas.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { memoryKeys, pluginInfo, TEST_KEY } from "./helpers/fake-plugin.ts";

const closing: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closing.splice(0).map((close) => close()));
});

/** Node's WebSocket with the Origin the plugin's iframe sends ("null"), as the plugin's SocketLink sees a socket. */
function nodeSocket(url: string): SocketLike {
  const socket = new WebSocket(url, { headers: { origin: "null" } });
  const like: SocketLike = {
    get readyState() {
      return socket.readyState;
    },
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    onopen: null,
    onmessage: null,
    onclose: null,
  };

  socket.onopen = () => like.onopen?.();
  socket.onmessage = (event) => like.onmessage?.({ data: event.data });
  socket.onclose = (event) =>
    like.onclose?.({
      code: event.code,
      reason: event.reason,
    });

  return like;
}

/**
 * The way of an execute call past its schema: the server, the bridge's WebSocket and the plugin's own link, whose
 * operation takes the code as the plugin's registry does (through the operation's schema) and answers with it.
 */
async function connected(): Promise<PluginClient> {
  const bridge = new BridgeServer({
    port: 0,
    token: "t".repeat(43),
    pluginOrigins: ["null"],
    serverVersion: "test",
    keys: memoryKeys(TEST_KEY),
  });
  const port = await bridge.listen();
  const ready = Promise.withResolvers<void>();
  const link = new SocketLink({
    url: `ws://127.0.0.1:${port}${BRIDGE_PATH}`,
    info: () => pluginInfo({ allowEdits: true }),
    key: TEST_KEY,
    onRequest: async (request) => ({
      ok: true,
      result: {
        result: OPERATION_SCHEMAS.execute.input.parse(request.input).code,
        logs: [],
      },
    }),
    onState: (state) => state.kind === "connected" && ready.resolve(),
    onPaired: () => undefined,
    createSocket: nodeSocket,
  });
  const view: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    plugins: () => bridge.plugins(),
    pairing: () => bridge.pairing(),
    request: (op, input, options) => bridge.request(op, input, options),
  };

  link.start();
  closing.push(async () => {
    link.stop();
    await bridge.close();
  });
  await ready.promise;

  return new PluginClient(view);
}

describe("execute over the bridge", () => {
  it("brings 90,000 characters of code to the plugin's operation whole", async () => {
    const code = `return "${"M0 0L1 1".repeat(11_250).slice(0, 90_000 - 'return "";'.length)}";`;

    expect(code).toHaveLength(90_000);
    expect(code.length).toBeLessThan(EXECUTE_CODE_CHARS);
    expect(await executeCode(await connected(), ExecuteInputSchema.parse({ code }))).toEqual({
      result: code,
      logs: [],
    });
  });
});
