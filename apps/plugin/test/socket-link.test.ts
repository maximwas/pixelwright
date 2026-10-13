import {
  BRIDGE_PROTOCOL_VERSION,
  MAX_MESSAGE_BYTES,
  newNonce,
  type PluginInfo,
  type PluginKey,
  proofFor,
} from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { reconnectDelay } from "../src/link/backoff.ts";
import { SocketLink } from "../src/link/socket-link.ts";
import type { LinkState, RequestOutcome, SocketLike } from "../src/types/link.ts";

class FakeSocket implements SocketLike {
  readyState = 0;
  closedWith: number | null = null;
  readonly sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(code = 1000): void {
    this.closedWith = code;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop(code: number, reason = ""): void {
    this.readyState = 3;
    this.onclose?.({
      code,
      reason,
    });
  }

  /** The hello this socket sent. */
  hello(): { keyId: string | null; nonce: string } {
    return this.sent.find((message) => message.type === "hello") as { keyId: string | null; nonce: string };
  }
}

const KEY: PluginKey = {
  id: "0123456789abcdef",
  secret: "ab".repeat(32),
};
const info: PluginInfo = {
  instanceId: "w",
  pluginVersion: "0.1.0",
  editorType: "figma",
  file: {
    name: "Orbit",
    key: null,
  },
  page: {
    id: "0:1",
    name: "Page 1",
  },
  allowEdits: false,
  visible: true,
};
const ack = {
  type: "hello_ack",
  protocol: 5,
  sessionId: "s",
  server: {
    name: "pixelwright",
    version: "0.1.0",
  },
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

interface Setup {
  readonly answer?: () => Promise<RequestOutcome>;
  readonly key?: PluginKey | null;
}

function setup({
  answer = async () => ({
    ok: true,
    result: { pong: true },
  }),
  key = KEY,
}: Setup = {}) {
  const sockets: FakeSocket[] = [];
  const states: LinkState[] = [];
  const scheduled: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const paired: PluginKey[] = [];
  const link = new SocketLink({
    url: "ws://localhost:18720/pixelwright/v1",
    info: () => info,
    key,
    onRequest: answer,
    onState: (state) => states.push(state),
    onPaired: (next) => paired.push(next),
    createSocket: () => {
      const socket = new FakeSocket();

      sockets.push(socket);

      return socket;
    },
    schedule: (run, ms) => {
      const entry = {
        run,
        ms,
        cancelled: false,
      };

      scheduled.push(entry);

      return () => {
        entry.cancelled = true;
      };
    },
    random: () => 0.5,
  });

  link.start();

  return {
    link,
    sockets,
    states,
    scheduled,
    paired,
  };
}

/** The real server's side of a challenge for this key. */
function challenge(socket: FakeSocket, key: PluginKey = KEY) {
  const nonce = newNonce();

  socket.receive({
    type: "challenge",
    nonce,
    proof: proofFor(key.secret, "server", socket.hello().nonce, nonce),
  });

  return nonce;
}

/** Opens a socket and completes the challenge-response with the default key. */
function connect(socket: FakeSocket | undefined) {
  if (socket === undefined) {
    throw new Error("no socket");
  }

  socket.open();
  challenge(socket);
  socket.receive(ack);
}

describe("SocketLink", () => {
  it("says hello with its key id and a fresh nonce", () => {
    const { sockets } = setup();

    sockets[0]?.open();
    expect(sockets[0]?.sent[0]).toEqual({
      type: "hello",
      protocol: 5,
      plugin: info,
      keyId: KEY.id,
      nonce: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
  });

  it("answers the server's challenge only after checking the server's proof", () => {
    const { sockets, states } = setup();
    const socket = sockets[0];

    socket?.open();

    const serverNonce = socket === undefined ? "" : challenge(socket);

    expect(socket?.sent).toContainEqual({
      type: "auth",
      proof: proofFor(KEY.secret, "plugin", serverNonce, socket?.hello().nonce ?? ""),
    });
    socket?.receive(ack);
    expect(states.at(-1)).toEqual({
      kind: "connected",
      serverVersion: "0.1.0",
    });
  });

  it("sends nothing and tries again later when the server cannot prove the key", () => {
    const { sockets, states, scheduled } = setup();

    sockets[0]?.open();
    sockets[0]?.receive({
      type: "challenge",
      nonce: newNonce(),
      proof: "0".repeat(64),
    });
    expect(sockets[0]?.sent.some((message) => message.type === "auth")).toBe(false);
    expect(sockets[0]?.closedWith).toBe(4401);
    expect(states.at(-1)).toMatchObject({
      kind: "waiting",
      reason: expect.stringContaining("could not prove"),
    });
    expect(scheduled).toHaveLength(1);
  });

  it("shows the code field when the server asks to pair, and sends the typed code", () => {
    const { link, sockets, states } = setup({ key: null });

    sockets[0]?.open();
    expect(sockets[0]?.hello().keyId).toBeNull();
    sockets[0]?.receive({
      type: "pairing_required",
      reason: "no_key",
      attemptsLeft: 5,
      expiresInMs: 120_000,
    });
    expect(states.at(-1)).toEqual({
      kind: "pairing",
      reason: "no_key",
      attemptsLeft: 5,
    });
    link.pair("123456");
    expect(sockets[0]?.sent.at(-1)).toEqual({
      type: "pair",
      code: "123456",
    });
  });

  it("keeps the key the server issues after the typed code, and says hello with it next time", () => {
    const { link, sockets, states, scheduled, paired } = setup({ key: null });
    const issued = {
      id: "fedcba9876543210",
      secret: "cd".repeat(32),
    };

    sockets[0]?.open();
    sockets[0]?.receive({
      type: "pairing_required",
      reason: "no_key",
      attemptsLeft: 5,
      expiresInMs: 120_000,
    });
    link.pair("123456");
    sockets[0]?.receive({
      type: "paired",
      key: issued,
    });
    sockets[0]?.receive(ack);
    expect(paired).toEqual([issued]);
    expect(states.at(-1)?.kind).toBe("connected");
    sockets[0]?.drop(1006);
    scheduled[0]?.run();
    sockets[1]?.open();
    expect(sockets[1]?.hello().keyId).toBe(issued.id);
  });

  it("refuses a key and an acknowledgement it did not earn", () => {
    const { sockets, states, paired } = setup({ key: null });

    sockets[0]?.open();
    sockets[0]?.receive({
      type: "paired",
      key: {
        id: "fedcba9876543210",
        secret: "cd".repeat(32),
      },
    });
    sockets[0]?.receive(ack);
    expect(paired).toEqual([]);
    expect(states.some((state) => state.kind === "connected")).toBe(false);
  });

  it("ignores requests before the server is trusted and acknowledged", async () => {
    const { sockets } = setup();

    sockets[0]?.open();
    sockets[0]?.receive({
      type: "request",
      id: "1",
      op: "ping",
      input: null,
      timeoutMs: 30_000,
    });
    await tick();
    expect(sockets[0]?.sent.some((message) => message.type === "response")).toBe(false);
  });

  it("keeps its key when a server says it does not know it, and shows the code field", () => {
    const { sockets, states, scheduled } = setup();

    sockets[0]?.open();
    sockets[0]?.receive({
      type: "pairing_required",
      reason: "unknown_key",
      attemptsLeft: 5,
      expiresInMs: 120_000,
    });
    expect(states.at(-1)).toMatchObject({
      kind: "pairing",
      reason: "unknown_key",
    });
    sockets[0]?.drop(1006);
    scheduled[0]?.run();
    sockets[1]?.open();
    // Whoever said so proved nothing: only a key issued after the user's code replaces this one.
    expect(sockets[1]?.hello().keyId).toBe(KEY.id);
  });

  it("keeps its key after a 4401 and tries again", () => {
    const { sockets, scheduled } = setup();

    sockets[0]?.open();
    sockets[0]?.drop(4401);
    expect(scheduled).toHaveLength(1);
    scheduled[0]?.run();
    sockets[1]?.open();
    expect(sockets[1]?.hello().keyId).toBe(KEY.id);
  });

  it("answers a request with what the main code returned", async () => {
    const { sockets } = setup();

    connect(sockets[0]);
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
    const { sockets } = setup({
      answer: async () => ({
        ok: true,
        result: "x".repeat(MAX_MESSAGE_BYTES),
      }),
    });

    connect(sockets[0]);
    sockets[0]?.receive({
      type: "request",
      id: "8",
      op: "ping",
      input: null,
      timeoutMs: 30_000,
    });
    await tick();
    expect(sockets[0]?.sent.at(-1)).toMatchObject({
      ok: false,
      error: { code: "RESULT_TOO_LARGE" },
    });
  });

  it("answers RESULT_NOT_SERIALIZABLE when the result cannot be encoded", async () => {
    const { sockets } = setup({
      answer: async () => ({
        ok: true,
        result: { big: 10n },
      }),
    });

    connect(sockets[0]);
    sockets[0]?.receive({
      type: "request",
      id: "9",
      op: "ping",
      input: null,
      timeoutMs: 30_000,
    });
    await tick();
    expect(sockets[0]?.sent.at(-1)).toMatchObject({
      id: "9",
      ok: false,
      error: { code: "RESULT_NOT_SERIALIZABLE" },
    });
  });

  it("sends info that changed before the hello was acknowledged", () => {
    const { link, sockets } = setup();

    sockets[0]?.open();
    link.sendInfo();
    expect(sockets[0]?.sent.some((message) => message.type === "event")).toBe(false);
    challenge(sockets[0] as FakeSocket);
    sockets[0]?.receive(ack);
    expect(sockets[0]?.sent.at(-1)).toMatchObject({
      type: "event",
      name: "plugin.info",
    });
  });

  it("reconnects with backoff after a drop and stops on a version mismatch", () => {
    const { sockets, states, scheduled } = setup();

    sockets[0]?.open();
    sockets[0]?.drop(1006);
    expect(states.at(-1)).toEqual({
      kind: "waiting",
      retryInMs: reconnectDelay(0, () => 0.5),
      reason: null,
    });
    scheduled[0]?.run();
    expect(sockets).toHaveLength(2);
    sockets[1]?.open();
    sockets[1]?.drop(4426);
    expect(states.at(-1)?.kind).toBe("stopped");
    expect(scheduled).toHaveLength(1);
  });

  it("says how to update when the plugin and the server speak different protocol versions", () => {
    const { sockets, states } = setup();

    sockets[0]?.open();
    sockets[0]?.drop(4426);
    // This text lives on in every copy of the plugin already out there, so it names the fix itself.
    expect(states.at(-1)).toMatchObject({
      kind: "stopped",
      reason: expect.stringContaining("npx -y pixelwright@latest"),
    });
  });

  it("keeps trying when an older server turns it away, since a newer one may take the port, and stops for a newer one", () => {
    const { sockets, states, scheduled } = setup();

    sockets[0]?.open();
    sockets[0]?.drop(4426, `protocol ${BRIDGE_PROTOCOL_VERSION - 1} required`);
    expect(states.at(-1)).toMatchObject({
      kind: "waiting",
      reason: expect.stringMatching(/older[\s\S]*npx -y pixelwright@latest/),
    });
    scheduled[0]?.run();
    sockets[1]?.open();
    sockets[1]?.drop(4426, `protocol ${BRIDGE_PROTOCOL_VERSION + 1} required`);
    expect(states.at(-1)).toMatchObject({
      kind: "stopped",
      reason: expect.stringContaining("npx -y pixelwright@latest"),
    });
    expect(scheduled).toHaveLength(1);
  });

  it("says why the server turned it away when too many plugins wait to pair", () => {
    const { sockets, states } = setup({ key: null });

    sockets[0]?.open();
    sockets[0]?.drop(4429);
    expect(states.at(-1)).toMatchObject({
      kind: "waiting",
      reason: expect.stringContaining("too many connections"),
    });
  });

  it("cancels a scheduled reconnect when stopped", () => {
    const { link, sockets, scheduled } = setup();

    sockets[0]?.open();
    sockets[0]?.drop(1006);
    link.stop();
    expect(scheduled[0]?.cancelled).toBe(true);
  });

  it("answers a request only on the connection it came in on", async () => {
    let release: (outcome: RequestOutcome) => void = () => {};
    const { sockets, scheduled } = setup({
      answer: () =>
        new Promise<RequestOutcome>((resolve) => {
          release = resolve;
        }),
    });

    connect(sockets[0]);
    sockets[0]?.receive({
      type: "request",
      id: "1",
      op: "slow",
      input: null,
      timeoutMs: 30_000,
    });
    sockets[0]?.drop(1006);
    scheduled[0]?.run();
    connect(sockets[1]);
    release({
      ok: true,
      result: "an answer for the server that went away",
    });
    await tick();
    expect(sockets[1]?.sent).not.toContainEqual(
      expect.objectContaining({
        type: "response",
        id: "1",
      }),
    );
  });

  it("ignores a late close of a socket it already replaced", () => {
    const { sockets, states, scheduled } = setup();

    sockets[0]?.open();
    sockets[0]?.drop(1006);
    scheduled[0]?.run();
    connect(sockets[1]);
    sockets[0]?.drop(4409);
    expect(states.at(-1)?.kind).toBe("connected");
  });
});
