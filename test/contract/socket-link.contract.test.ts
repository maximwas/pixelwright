import { afterEach, describe, expect, it, vi } from "vitest";
import { Backoff } from "@/plugin-ui/link/backoff/backoff.ts";
import { SocketLink } from "@/plugin-ui/link/socket-link/socket-link.ts";
import type { LinkObserver, LinkState, SocketOpener } from "@/plugin-ui/link/socket-link/socket-link.types.ts";
import { LINK_TEXT } from "@/plugin-ui/link/stop-reasons/stop-reasons.constants.ts";
import { StopReasons } from "@/plugin-ui/link/stop-reasons/stop-reasons.ts";
import type { PluginKey } from "@/shared/protocol/handshake.schema.ts";
import { MemorySocket } from "@/shared/protocol/memory-socket/memory-socket.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";
import { MemoryBridge as Bridge } from "./support/memory-bridge.ts";

// The window's SocketLink against item 03's real PluginConnection, both real classes, over linked memory sockets.

/** A program on the port that answers hello as it likes: frames to send, or a close. */
class Impostor implements SocketOpener {
  readonly plugins: MemorySocket[] = [];
  readonly #answer: (server: MemorySocket) => void;

  constructor(answer: (server: MemorySocket) => void) {
    this.#answer = answer;
  }

  open(): MemorySocket {
    const [plugin, server] = MemorySocket.pair();

    server.onMessage(() => this.#answer(server));
    this.plugins.push(plugin);

    return plugin;
  }
}

/** The window's side as the link sees it: what it showed, the keys it handed main to store, the session frames. */
class Window implements LinkObserver {
  readonly states: LinkState[] = [];
  readonly keys: PluginKey[] = [];
  readonly frames: [number, string][] = [];
  readonly #instanceId: string;

  constructor(instanceId = "window-a") {
    this.#instanceId = instanceId;
  }

  info(): PluginInfo {
    return {
      instanceId: this.#instanceId,
      pluginVersion: "0.8.0",
      editorType: "figma",
      file: {
        name: "Test MCP",
        key: null,
      },
      page: {
        id: "0:1",
        name: "Start here",
      },
      allowEdits: false,
      visible: true,
    };
  }

  state(state: LinkState): void {
    this.states.push(state);
  }

  paired(key: PluginKey): void {
    this.keys.push(key);
  }

  frame(
    epoch: number,
    text: string,
  ): void {
    this.frames.push([epoch, text]);
  }

  last(): LinkState | undefined {
    return this.states.at(-1);
  }
}

const link = (opener: SocketOpener) => new SocketLink(opener, new Backoff(), new StopReasons());

const CONNECTED = { kind: "connected" };

afterEach(() => {
  vi.useRealTimers();
});

describe("SocketLink against the server's PluginConnection", () => {
  it("pairs with the code status shows, hands main the key bridge.json holds, and becomes a session", () => {
    const bridge = new Bridge();
    const window = new Window();
    const socketLink = link(bridge);

    socketLink.start(null, window);
    expect(window.last()).toEqual({
      kind: "pairing",
      reason: "no_key",
      attemptsLeft: 5,
    });

    socketLink.pair(bridge.code());

    expect(window.keys).toHaveLength(1);
    expect(bridge.keys.findKey(window.keys[0]?.id ?? "")).toEqual(window.keys[0]);
    expect(window.last()).toEqual(CONNECTED);
    expect(bridge.sessions.files().map((file) => file.name)).toEqual(["Test MCP"]);
  });

  it("reconnects with the stored key: the server proves it first, and no code is asked", () => {
    const bridge = new Bridge();
    const window = new Window();

    link(bridge).start(bridge.keys.addKey(), window);

    expect(window.states).toEqual([{ kind: "connecting" }, CONNECTED]);
    expect(window.keys).toEqual([]);
  });

  it("stops when another window of the plugin takes over (4409), and never knocks again", () => {
    vi.useFakeTimers();

    const bridge = new Bridge();
    const key = bridge.keys.addKey();
    const first = new Window("same-window");
    const second = new Window("same-window");

    link(bridge).start(key, first);
    link(bridge).start(key, second);
    vi.advanceTimersByTime(60_000);

    expect(first.last()).toEqual({
      kind: "stopped",
      reason: LINK_TEXT.superseded,
    });
    expect(second.last()).toEqual(CONNECTED);
    expect(bridge.plugins).toHaveLength(2);
  });

  it("closes a server that cannot prove the key with 4401, keeps the key, and offers it again", () => {
    vi.useFakeTimers();

    const bridge = new Bridge();
    const key = bridge.keys.addKey();
    const window = new Window();

    link(bridge).start(
      {
        id: key.id,
        secret: "00".repeat(32),
      },
      window,
    );

    expect(bridge.plugins[0]?.closed?.code).toBe(4401);
    // The window never proves its key to a server that did not prove it first.
    expect(bridge.plugins[0]?.sent.map((frame) => frame.type)).toEqual(["hello"]);
    expect(window.last()).toMatchObject({
      kind: "waiting",
      reason: LINK_TEXT.unproven,
    });

    vi.advanceTimersByTime(750);

    expect(bridge.plugins[1]?.sent[0]).toMatchObject({
      type: "hello",
      keyId: key.id,
    });
    expect(window.keys).toEqual([]);
  });
});

describe("SocketLink and a program that did not earn a step", () => {
  it("ignores a paired the window never asked for, and the hello_ack after it", () => {
    const window = new Window();
    const impostor = new Impostor((server) => {
      server.send(
        JSON.stringify({
          type: "paired",
          key: {
            id: "ab".repeat(8),
            secret: "cd".repeat(32),
          },
        }),
      );
      server.send(
        JSON.stringify({
          type: "hello_ack",
          protocol: 6,
          sessionId: "1",
          server: {
            name: "pixelwright-new",
            version: "0.8.0",
          },
        }),
      );
    });

    link(impostor).start(null, window);

    expect(window.keys).toEqual([]);
    expect(window.states).toEqual([{ kind: "connecting" }]);
  });

  it.each([
    ["an older server", 5, "waiting", LINK_TEXT.olderServer, 2],
    ["a newer server", 7, "stopped", LINK_TEXT.update, 1],
  ])("after a 4426 from %s, is %s", (_case, protocol, kind, reason, sockets) => {
    vi.useFakeTimers();

    const window = new Window();
    const impostor = new Impostor((server) => server.close(4426, `protocol ${protocol} required`));

    link(impostor).start(null, window);

    expect(window.last()).toMatchObject({
      kind,
      reason,
    });

    vi.advanceTimersByTime(750);

    expect(impostor.plugins).toHaveLength(sockets);
  });
});

describe("SocketLink's sessions", () => {
  it("relays the session's frames with their epoch, and drops a frame main sends for a socket that is gone", () => {
    vi.useFakeTimers();

    const bridge = new Bridge();
    const window = new Window();
    const socketLink = link(bridge);

    socketLink.start(bridge.keys.addKey(), window);
    bridge.servers[0]?.close(1001, "going away");
    vi.advanceTimersByTime(750);
    socketLink.relay(1, '{"stale":true}');
    socketLink.relay(2, '{"fresh":true}');
    bridge.servers[1]?.send('{"rpc":true}');
    // What a browser may still deliver from the socket that went: a late frame, a late close.
    bridge.plugins[0]?.receive('{"late":true}');
    bridge.plugins[0]?.hangUp(1006);

    expect(window.last()).toEqual(CONNECTED);
    expect(bridge.plugins[1]?.sent.filter((frame) => frame.type === undefined)).toEqual([{ fresh: true }]);
    expect(window.frames).toEqual([[2, '{"rpc":true}']]);
  });

  it("starts the backoff over once the server acknowledged a session", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const window = new Window();
    const bridge = new Bridge();
    const socketLink = link(bridge);

    socketLink.start(bridge.keys.addKey(), window);

    for (const server of [0, 1]) {
      bridge.servers[server]?.close(1001, "going away");
      vi.advanceTimersByTime(10_000);
    }

    const waits = window.states.flatMap((state) => (state.kind === "waiting" ? [state.retryInMs] : []));

    expect(waits).toEqual([250, 250]);
  });
});
