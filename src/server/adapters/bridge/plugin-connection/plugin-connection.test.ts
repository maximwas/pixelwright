import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemorySocket } from "../../../../shared/protocol/memory-socket/memory-socket.ts";
import { Proof } from "../../../../shared/protocol/proof/proof.ts";
import { AtomicJsonFile } from "../../files/atomic-json-file/atomic-json-file.ts";
import { PinoLogger } from "../../logging/pino-logger/pino-logger.ts";
import { BridgeConfig } from "../bridge-config/bridge-config.ts";
import { PairingCodes } from "../pairing-codes/pairing-codes.ts";
import { SessionRegistry } from "../sessions/session-registry/session-registry.ts";
import { PluginConnection } from "./plugin-connection.ts";

const PLUGIN_NONCE = "00112233445566778899aabbccddeeff";

/** A 0.8.0 hello, fields in 0.7.0's order. */
const hello = (
  keyId: string | null,
  instanceId = "window-a",
) => ({
  type: "hello",
  protocol: 6,
  plugin: {
    instanceId,
    pluginVersion: "0.8.0",
    editorType: "figma",
    file: {
      name: `File of ${instanceId}`,
      key: null,
    },
    page: {
      id: "0:1",
      name: "Start here",
    },
    allowEdits: false,
    visible: true,
  },
  keyId,
  nonce: PLUGIN_NONCE,
});

/** The owner's services built by hand over bridge.json in a temp home, with every log line they write. */
class HandshakeProbe {
  readonly lines: Record<string, unknown>[] = [];
  readonly logger = new PinoLogger(
    {
      level: "debug",
      file: "unused",
    },
    [{ write: (line: string) => this.lines.push(JSON.parse(line)) }],
  );

  readonly clock = { now: () => Date.now() };
  readonly pairing = new PairingCodes(this.clock, this.logger);
  readonly sessions = new SessionRegistry(this.pairing, this.logger);
  readonly keys: BridgeConfig;

  constructor(configFile = join(mkdtempSync(join(tmpdir(), "pixelwright-handshake-")), "bridge.json")) {
    this.keys = new BridgeConfig(
      new AtomicJsonFile(this.logger),
      {
        port: 0,
        pluginOrigins: [],
        configFile,
      },
      this.clock,
    );
  }

  connect(frame?: unknown): MemorySocket {
    const socket = new MemorySocket();

    new PluginConnection(socket, {
      keys: this.keys,
      pairing: this.pairing,
      sessions: this.sessions,
      logger: this.logger,
    }).start();

    if (frame !== undefined) {
      socket.receive(frame);
    }

    return socket;
  }

  /** The code status shows, sent as the user typed it. */
  pair(socket: MemorySocket): string {
    const code = this.sessions.pairing()?.code ?? "";

    socket.receive({
      type: "pair",
      code,
    });

    return code;
  }
}

/** The plugin's proof over the challenge the server just sent. */
const auth = (
  socket: MemorySocket,
  secret: string,
) => ({
  type: "auth",
  proof: Proof.sign(secret, "plugin", String(socket.last().nonce), PLUGIN_NONCE).hex(),
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PluginConnection, before the session", () => {
  it.each([
    ["a socket that says no hello", () => [], 5_000, "hello timeout"],
    ["a challenged plugin that sends no proof", (probe: HandshakeProbe) => [hello(probe.keys.addKey().id)], 5_000, "auth timeout"],
    ["an unpaired window", () => [hello(null)], 120_000, "waited too long for the pairing code"],
  ])("closes %s with 4408 when its time is up, and frees its slot", (_case, frames, ms, reason) => {
    vi.useFakeTimers();

    const probe = new HandshakeProbe();
    const socket = probe.connect();

    for (const frame of frames(probe)) {
      socket.receive(frame);
    }

    vi.advanceTimersByTime(ms - 1);
    expect(socket.closed).toBeNull();
    vi.advanceTimersByTime(1);
    expect(socket.closed).toEqual({
      code: 4408,
      reason,
    });
    expect(probe.sessions.pairing()).toBeNull();
  });

  it('turns a 0.7.0 plugin away with 4426 "protocol 6 required", and keeps it for the status hint', () => {
    const probe = new HandshakeProbe();
    const old = hello(null);
    const socket = probe.connect({
      ...old,
      protocol: 5,
      plugin: {
        ...old.plugin,
        pluginVersion: "0.7.0",
      },
    });

    expect(socket.closed).toEqual({
      code: 4426,
      reason: "protocol 6 required",
    });
    expect(socket.sent).toEqual([]);
    expect(probe.sessions.refusal()).toEqual({
      protocol: 5,
      pluginVersion: "0.7.0",
    });
  });

  const early = {
    type: "auth",
    proof: "ab".repeat(32),
  };
  const unbounded = {
    ...hello(null),
    plugin: {
      ...hello(null).plugin,
      instanceId: "x".repeat(65),
    },
  };

  it.each([
    ["a frame that is not JSON", "{", "invalid message"],
    ["a binary frame", null, "invalid message"],
    ["a frame before hello", early, "expected hello"],
    ["a hello with an instance id past its bound", unbounded, "invalid message"],
  ])("closes %s with 4400", (_case, frame, reason) => {
    expect(new HandshakeProbe().connect(frame).closed).toEqual({
      code: 4400,
      reason,
    });
  });
});

describe("PluginConnection, a paired plugin", () => {
  it("is challenged by a server that proves the key first, and let in once it proves the key back", () => {
    const probe = new HandshakeProbe();
    const key = probe.keys.addKey();
    const socket = probe.connect(hello(key.id));
    const challenge = socket.last();

    expect(challenge).toEqual({
      type: "challenge",
      nonce: expect.stringMatching(/^[0-9a-f]{32}$/),
      proof: Proof.sign(key.secret, "server", PLUGIN_NONCE, String(challenge.nonce)).hex(),
    });
    socket.receive(auth(socket, key.secret));
    expect(socket.last()).toEqual({
      type: "hello_ack",
      protocol: 6,
      sessionId: expect.any(String),
      server: {
        name: "pixelwright-new",
        version: expect.any(String),
      },
    });
    expect(probe.sessions.files()).toMatchObject([
      {
        name: "File of window-a",
        active: true,
      },
    ]);
  });

  it("closes a plugin whose proof is wrong with 4401", () => {
    const probe = new HandshakeProbe();
    const socket = probe.connect(hello(probe.keys.addKey().id));

    socket.receive(auth(socket, "cd".repeat(32)));

    expect(socket.closed).toEqual({
      code: 4401,
      reason: "the plugin could not prove its key",
    });
    expect(probe.sessions.files()).toEqual([]);
  });

  it("closes the older socket of a window that says hello again with 4409, and lets it go at once", () => {
    const probe = new HandshakeProbe();
    const key = probe.keys.addKey();
    const older = probe.connect(hello(key.id));

    older.receive(auth(older, key.secret));

    const newer = probe.connect(hello(key.id));

    newer.receive(auth(newer, key.secret));

    // The older socket's close event has not come (a dead socket's may never), yet only the newer one is listed.
    expect(older.closed).toEqual({
      code: 4409,
      reason: "superseded by a newer connection of the same plugin window",
    });
    expect(probe.sessions.files()).toEqual([expect.objectContaining({ session: newer.last().sessionId })]);
    older.hangUp(4409);
    expect(probe.sessions.files()).toHaveLength(1);
  });
});

describe("PluginConnection, an unpaired plugin", () => {
  it.each([
    ["no key", null, "no_key"],
    ["a key bridge.json lacks", "feedfacefeedface", "unknown_key"],
  ])("with %s is asked to pair, and status shows a code for it", (_case, keyId, reason) => {
    const probe = new HandshakeProbe();
    const socket = probe.connect(hello(keyId));

    expect(socket.sent).toEqual([
      {
        type: "pairing_required",
        reason,
        attemptsLeft: 5,
        expiresInMs: 0,
      },
    ]);
    expect(socket.closed).toBeNull();
    expect(probe.sessions.pairing()?.waiting).toBe(1);
    expect(probe.sessions.files()).toEqual([]);
  });

  it("that sends the right code gets a stored key, then hello_ack, and is a session", () => {
    const probe = new HandshakeProbe();
    const socket = probe.connect(hello(null));

    probe.pair(socket);

    const [, paired, ack] = socket.sent;
    const key = (paired?.key ?? {}) as { id?: string };

    expect(paired).toEqual({
      type: "paired",
      key: probe.keys.findKey(String(key.id)),
    });
    expect(ack).toMatchObject({ type: "hello_ack" });
    expect(probe.sessions.files()).toMatchObject([{ session: ack?.sessionId }]);
    expect(probe.sessions.pairing()).toBeNull();
  });

  it("is closed with 4429 when eight unpaired windows wait already", () => {
    const probe = new HandshakeProbe();
    const sockets = Array.from({ length: 9 }, (_window, index) => probe.connect(hello(null, `window-${index}`)));

    expect(sockets.map((socket) => socket.closed?.code ?? null)).toEqual([...Array(8).fill(null), 4429]);
    expect(sockets[8]?.closed?.reason).toBe("too many plugins waiting to be paired");
    expect(probe.sessions.pairing()?.waiting).toBe(8);
  });

  it("is closed with 1011 when its new key cannot be stored", () => {
    const probe = new HandshakeProbe("/dev/null/bridge.json");
    const socket = probe.connect(hello(null));

    probe.pair(socket);

    expect(socket.closed).toEqual({
      code: 1011,
      reason: "the key could not be stored",
    });
  });
});

describe("PluginConnection's log", () => {
  it("tells the story but never holds a code, a nonce, a proof or a key's secret", () => {
    const probe = new HandshakeProbe();
    const paired = probe.connect(hello(null, "window-new"));
    const code = probe.pair(paired);
    const key = probe.keys.addKey();
    const challenged = probe.connect(hello(key.id));
    const answer = auth(challenged, key.secret);

    challenged.receive(answer);

    const secrets = [code, PLUGIN_NONCE, answer.proof, key.secret, JSON.stringify(paired.sent[1])];
    const strings = probe.lines.flatMap((line) => Object.values(line).filter((value) => typeof value === "string"));

    secrets.push(String(challenged.sent[0]?.nonce), String(challenged.sent[0]?.proof));
    expect(probe.lines.map((line) => line.msg)).toContain("plugin connected");
    expect(secrets.filter((secret) => strings.some((value) => value.includes(secret)))).toEqual([]);
  });
});
