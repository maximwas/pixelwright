import { MAX_MESSAGE_BYTES, type PluginInfo } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { reconnectDelay } from "../src/link/backoff.ts";
import { SocketLink } from "../src/link/socket-link.ts";
import type { LinkState, RequestOutcome, SocketLike } from "../src/types/link.ts";

class FakeSocket implements SocketLike {
  readyState = 0;
  readonly sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {}

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop(code: number): void {
    this.readyState = 3;
    this.onclose?.({
      code,
      reason: "",
    });
  }
}

const info: PluginInfo = {
  instanceId: "w",
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
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(
  answer: () => Promise<RequestOutcome> = async () => ({
    ok: true,
    result: { pong: true },
  }),
) {
  const sockets: FakeSocket[] = [];
  const states: LinkState[] = [];
  const scheduled: { run: () => void; ms: number }[] = [];
  const link = new SocketLink({
    url: "ws://localhost:18720/pixelwright/v1",
    info: () => info,
    onRequest: answer,
    onState: (state) => states.push(state),
    createSocket: () => {
      const socket = new FakeSocket();

      sockets.push(socket);

      return socket;
    },
    schedule: (run, ms) =>
      scheduled.push({
        run,
        ms,
      }),
    random: () => 0.5,
  });

  link.start();

  return {
    link,
    sockets,
    states,
    scheduled,
  };
}

const ack = {
  type: "hello_ack",
  protocol: 1,
  sessionId: "s",
  server: {
    name: "pixelwright",
    version: "0.1.0",
  },
};

describe("SocketLink", () => {
  it("says hello on open and reports connected after the ack", () => {
    const { sockets, states } = setup();

    sockets[0]?.open();
    expect(sockets[0]?.sent[0]).toEqual({
      type: "hello",
      protocol: 1,
      plugin: info,
    });
    sockets[0]?.receive(ack);
    expect(states.at(-1)).toEqual({
      kind: "connected",
      serverVersion: "0.1.0",
    });
  });

  it("answers a request with what the main code returned", async () => {
    const { sockets } = setup();

    sockets[0]?.open();
    sockets[0]?.receive(ack);
    sockets[0]?.receive({
      type: "request",
      id: "7",
      op: "ping",
      input: null,
      timeoutMs: 30_000,
    });
    await tick();
    expect(sockets[0]?.sent.at(-1)).toEqual({
      type: "response",
      id: "7",
      ok: true,
      result: { pong: true },
    });
  });

  it("sends RESULT_TOO_LARGE instead of a frame over the bridge's limit", async () => {
    const { sockets } = setup(async () => ({
      ok: true,
      result: "x".repeat(MAX_MESSAGE_BYTES),
    }));

    sockets[0]?.open();
    sockets[0]?.receive(ack);
    sockets[0]?.receive({
      type: "request",
      id: "8",
      op: "ping",
      input: null,
      timeoutMs: 30_000,
    });
    await tick();
    expect(sockets[0]?.sent.at(-1)).toMatchObject({
      type: "response",
      id: "8",
      ok: false,
      error: { code: "RESULT_TOO_LARGE" },
    });
  });

  it("reconnects with backoff after a drop and stops on a version mismatch", () => {
    const { sockets, states, scheduled } = setup();

    sockets[0]?.open();
    sockets[0]?.drop(1006);
    expect(states.at(-1)).toEqual({
      kind: "waiting",
      retryInMs: reconnectDelay(0, () => 0.5),
    });
    scheduled[0]?.run();
    expect(sockets).toHaveLength(2);
    sockets[1]?.open();
    sockets[1]?.drop(4426);
    expect(states.at(-1)?.kind).toBe("stopped");
    expect(scheduled).toHaveLength(1);
  });

  it("ignores a late close of a socket it already replaced", () => {
    const { sockets, states, scheduled } = setup();

    sockets[0]?.open();
    sockets[0]?.drop(1006);
    scheduled[0]?.run();
    sockets[1]?.open();
    sockets[1]?.receive(ack);
    sockets[0]?.drop(4409);
    expect(states.at(-1)?.kind).toBe("connected");
  });
});
