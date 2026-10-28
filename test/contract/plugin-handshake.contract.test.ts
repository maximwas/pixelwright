import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import * as zod from "zod/mini";
import { ServerMain } from "../../src/server/main/server.main.ts";
import { type StatusOutput, StatusOutputSchema } from "../../src/server/tools/status/status.schema.ts";
import { Proof } from "../../src/shared/protocol/proof/proof.ts";

/** Frames 0.7.0 sends, recorded from its own code, as the exact bytes on the wire. */
const RECORDING = JSON.parse(readFileSync(new URL("../golden/fixtures/handshake-0.7.0.json", import.meta.url), "utf8"));
const PLUGIN: Record<string, string> = RECORDING.pluginToServer;
const SERVER: Record<string, string> = RECORDING.serverToPlugin;

/** A recorded plugin frame with some fields changed in place: the order stays 0.7.0's. */
const recorded = (
  name: string,
  changes: Record<string, unknown> = {},
) =>
  JSON.stringify({
    ...JSON.parse(PLUGIN[name] ?? "{}"),
    ...changes,
  });

/** Every key of a frame, nested ones as paths, in order: equal lists mean the same fields in the same places. */
const keysOf = (
  value: unknown,
  path = "",
): string[] =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([key, inner]) => [`${path}${key}`, ...keysOf(inner, `${path}${key}.`)])
    : [];

/** The keys of a recorded server frame. */
const recordedKeys = (name: string) => keysOf(JSON.parse(SERVER[name] ?? "{}"));

/** A plugin's window on the owner's port: what the server sends it, and how it closes. */
class PluginWindow {
  readonly frames: Record<string, unknown>[] = [];
  readonly closed: Promise<{ code: number; reason: string }>;
  readonly #socket: WebSocket;

  constructor(port: number) {
    this.#socket = new WebSocket(`ws://127.0.0.1:${port}/pixelwright/v1`, { origin: "null" });
    this.#socket.on("message", (data) => this.frames.push(JSON.parse(String(data))));
    this.closed = new Promise((resolve) => {
      this.#socket.on("close", (code, reason) => resolve({
        code,
        reason: String(reason),
      }));
    });
  }

  async send(text: string): Promise<void> {
    if (this.#socket.readyState === WebSocket.CONNECTING) {
      await new Promise((resolve) => this.#socket.once("open", resolve));
    }

    this.#socket.send(text);
  }

  /** The server's frames once it has sent `count` of them. */
  async received(count: number): Promise<Record<string, unknown>[]> {
    while (this.frames.length < count) {
      await new Promise((resolve) => this.#socket.once("message", resolve));
    }

    return this.frames;
  }

  close(): void {
    this.#socket.close();
  }
}

/** The server as the composition root wires it with the bridge on, in a temp home, on a free port. */
class Owner {
  readonly home = mkdtempSync(join(tmpdir(), "pixelwright-handshake-"));
  readonly server = new ServerMain({
    home: this.home,
    logLevel: "silent",
    pluginBridge: true,
    bridgePort: 0,
    pluginOrigins: [],
  });

  readonly client = new Client({
    name: "contract",
    version: "1.0.0",
  });

  readonly windows: PluginWindow[] = [];
  port = 0;

  async start(): Promise<this> {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

    await this.server.listen();
    await this.server.endpoint().connect(serverSide);
    await this.client.connect(clientSide);
    this.port = (await this.status()).server.port;

    return this;
  }

  window(): PluginWindow {
    const window = new PluginWindow(this.port);

    this.windows.push(window);

    return window;
  }

  async status(): Promise<StatusOutput> {
    const answer = await this.client.callTool({
      name: "status",
      arguments: {},
    });

    return zod.parse(StatusOutputSchema, answer.structuredContent);
  }

  async close(): Promise<void> {
    for (const window of this.windows) {
      window.close();
    }

    await this.client.close();
    await this.server.close();
  }
}

const owners: Owner[] = [];

const owner = async (): Promise<Owner> => {
  const started = new Owner();

  owners.push(started);

  return started.start();
};

afterEach(async () => {
  await Promise.all(owners.splice(0).map((started) => started.close()));
});

describe("the plugin handshake through the composition root, with 0.7.0's recorded frames", () => {
  it("turns a 0.7.0 plugin away with 4426, and status names it", async () => {
    const server = await owner();
    const window = server.window();

    await window.send(PLUGIN.helloNoKey ?? "");

    expect(await window.closed).toEqual({
      code: 4426,
      reason: RECORDING.versionMismatchReason,
    });
    expect((await server.status()).hint).toBe(
      "The Pixelwright New plugin 0.7.0 that tried to connect is older than this server (protocol 5; this server speaks 6), so it was turned away: ask the user to install the plugin that comes with this server's version and run it again in Figma.",
    );
  });

  it("asks a plugin with a key it lacks to pair, shows the code in status, and pairs it with that code", async () => {
    const server = await owner();
    const window = server.window();
    const unknownKey = {
      protocol: 6,
      keyId: "feedfacefeedface",
    };

    await window.send(recorded("helloNoKey", unknownKey));

    const [prompt] = await window.received(1);
    const { pairing } = await server.status();

    expect(keysOf(prompt)).toEqual(recordedKeys("pairingRequired"));
    expect(prompt).toMatchObject({ reason: "unknown_key" });
    expect(pairing).toMatchObject({ waiting: 1 });

    await window.send(recorded("pair", { code: pairing?.code === "000000" ? "000001" : "000000" }));

    const [, wrong] = await window.received(2);

    expect(keysOf(wrong)).toEqual(recordedKeys("wrongCode"));
    expect(wrong).toMatchObject({ attemptsLeft: 4 });

    await window.send(recorded("pair", { code: pairing?.code }));

    const [, , paired, ack] = await window.received(4);
    const stored = JSON.parse(readFileSync(join(server.home, "bridge.json"), "utf8")).pluginKeys;
    const file = {
      session: ack?.sessionId,
      name: "Test MCP",
      active: true,
    };

    expect(keysOf(paired)).toEqual(recordedKeys("paired"));
    expect(keysOf(ack)).toEqual(recordedKeys("helloAck"));
    expect(stored).toEqual([expect.objectContaining(paired?.key as object)]);
    expect(await server.status()).toMatchObject({
      files: [file],
      pairing: null,
      hint: null,
    });
  });

  it("challenges a paired plugin, proving the key first, and lets it in on its proof", async () => {
    const server = await owner();
    const first = server.window();

    // Pair once to put a key in bridge.json, then come back with it as another window.
    await first.send(recorded("helloNoKey", { protocol: 6 }));
    await first.received(1);
    await first.send(recorded("pair", { code: (await server.status()).pairing?.code }));

    const [, paired] = await first.received(3);
    const key = paired?.key as { id: string; secret: string };
    const window = server.window();
    const withKey = {
      protocol: 6,
      keyId: key.id,
      plugin: {
        ...JSON.parse(PLUGIN.helloWithKey ?? "{}").plugin,
        instanceId: "another-window",
      },
    };

    await window.send(recorded("helloWithKey", withKey));

    const [challenge] = await window.received(1);
    const nonce = String(challenge?.nonce);
    const auth = {
      type: "auth",
      proof: Proof.sign(key.secret, "plugin", nonce, RECORDING.pluginNonce).hex(),
    };

    expect(keysOf(challenge)).toEqual(recordedKeys("challenge"));
    expect(challenge?.proof).toBe(Proof.sign(key.secret, "server", RECORDING.pluginNonce, nonce).hex());

    await window.send(JSON.stringify(auth));

    const [, ack] = await window.received(2);

    expect(keysOf(ack)).toEqual(recordedKeys("helloAck"));
    expect((await server.status()).files).toHaveLength(2);
  });
});
