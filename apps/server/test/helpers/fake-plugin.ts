import { once } from "node:events";
import { BRIDGE_PATH, BRIDGE_PROTOCOL_VERSION, type PluginInfo } from "@pixelwright/core";
import WebSocket from "ws";

export const pluginInfo = (overrides: Partial<PluginInfo> = {}): PluginInfo => ({
  instanceId: "window-a",
  pluginVersion: "0.1.0",
  editorType: "figma",
  file: {
    name: "Positivus",
    key: null,
  },
  page: {
    id: "0:1",
    name: "Page 1",
  },
  allowEdits: false,
  visible: true,
  ...overrides,
});

interface FakePluginOptions {
  readonly protocol?: number;
  /** What the plugin answers to a request; null: it never answers. */
  readonly answer?: ((op: string) => unknown) | null;
}

/** The plugin's UI iframe as the bridge sees it: says hello, answers requests, records what it receives. */
export async function connectPlugin(port: number, info: PluginInfo, options: FakePluginOptions = {}) {
  const { protocol = BRIDGE_PROTOCOL_VERSION, answer = (op: string) => ({ op }) } = options;
  const socket = new WebSocket(`ws://127.0.0.1:${port}${BRIDGE_PATH}`, { origin: "null" });
  const received: unknown[] = [];
  const closed = new Promise<number>((resolve) => socket.on("close", (code) => resolve(code)));

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as { type: string; id: string; op: string };

    received.push(message);

    if (message.type === "request" && answer !== null) {
      socket.send(
        JSON.stringify({
          type: "response",
          id: message.id,
          ok: true,
          result: answer(message.op),
        }),
      );
    }
  });
  await once(socket, "open");
  socket.send(
    JSON.stringify({
      type: "hello",
      protocol,
      plugin: info,
    }),
  );

  return {
    socket,
    received,
    closed,
    sendInfo: (next: PluginInfo) =>
      socket.send(
        JSON.stringify({
          type: "event",
          name: "plugin.info",
          data: next,
        }),
      ),
  };
}
