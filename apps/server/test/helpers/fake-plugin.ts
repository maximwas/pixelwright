import { once } from "node:events";
import {
  BRIDGE_PATH,
  BRIDGE_PROTOCOL_VERSION,
  newKeyId,
  newNonce,
  newSecret,
  type PluginInfo,
  type PluginKey,
  proofEquals,
  proofFor,
} from "@pixelwright/core";
import WebSocket from "ws";
import type { PluginKeys } from "../../src/types/bridge.ts";

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

/** The key the fake plugin pairs with by default; servers under test start with it in their store. */
export const TEST_KEY: PluginKey = {
  id: "0123456789abcdef",
  secret: "ab".repeat(32),
};

/** Paired plugins' keys kept in memory, for servers under test. */
export function memoryKeys(...keys: PluginKey[]): PluginKeys {
  const store = new Map(keys.map((key) => [key.id, key]));

  return {
    find: (id) => store.get(id) ?? null,
    add: () => {
      const key = {
        id: newKeyId(),
        secret: newSecret(),
      };

      store.set(key.id, key);

      return key;
    },
  };
}

interface FakePluginOptions {
  readonly protocol?: number;
  /** What the plugin answers to a request; null: it never answers. */
  readonly answer?: ((op: string) => unknown) | null;
  /** Its stored key; with it, the plugin answers the server's challenge once the server proved the key too. */
  readonly key?: PluginKey | null;
}

/** The plugin's UI iframe as the bridge sees it: says hello, proves its key, answers requests, records what it gets. */
export async function connectPlugin(port: number, info: PluginInfo, options: FakePluginOptions = {}) {
  const { protocol = BRIDGE_PROTOCOL_VERSION, answer = (op: string) => ({ op }), key = TEST_KEY } = options;
  const socket = new WebSocket(`ws://127.0.0.1:${port}${BRIDGE_PATH}`, { origin: "null" });
  const received: Record<string, unknown>[] = [];
  const closed = new Promise<number>((resolve) => socket.on("close", (code) => resolve(code)));
  const nonce = newNonce();

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as Record<string, string>;

    received.push(message);

    if (message.type === "challenge" && key !== null) {
      if (!proofEquals(message.proof ?? "", proofFor(key.secret, "server", nonce, message.nonce ?? ""))) {
        socket.close();

        return;
      }

      socket.send(
        JSON.stringify({
          type: "auth",
          proof: proofFor(key.secret, "plugin", message.nonce ?? "", nonce),
        }),
      );
    }

    if (message.type === "request" && answer !== null) {
      socket.send(
        JSON.stringify({
          type: "response",
          id: message.id,
          ok: true,
          result: answer(message.op ?? ""),
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
      keyId: key?.id ?? null,
      nonce,
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

/** A plugin speaking the protocol by hand: says hello with a key id (or none) and lets the test drive the rest. */
export async function rawPlugin(port: number, keyId: string | null, info: PluginInfo = pluginInfo()) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${BRIDGE_PATH}`, { origin: "null" });
  const messages: Record<string, unknown>[] = [];
  const taken = new Set<Record<string, unknown>>();
  const waiters: (() => void)[] = [];
  const closed = new Promise<number>((resolve) => socket.on("close", (code) => resolve(code)));
  const nonce = newNonce();

  socket.on("message", (data) => {
    messages.push(JSON.parse(data.toString()) as Record<string, unknown>);

    for (const wake of waiters.splice(0)) {
      wake();
    }
  });
  await once(socket, "open");
  socket.send(
    JSON.stringify({
      type: "hello",
      protocol: BRIDGE_PROTOCOL_VERSION,
      plugin: info,
      keyId,
      nonce,
    }),
  );

  /** The next message of this type the test has not taken yet. */
  const next = async (type: string): Promise<Record<string, unknown>> => {
    for (;;) {
      const found = messages.find((message) => message.type === type && !taken.has(message));

      if (found !== undefined) {
        taken.add(found);

        return found;
      }

      await new Promise<void>((resolve) => waiters.push(resolve));
    }
  };

  return {
    socket,
    nonce,
    closed,
    next,
    send: (message: unknown) => socket.send(JSON.stringify(message)),
  };
}
