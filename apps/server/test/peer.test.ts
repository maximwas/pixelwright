import { once } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BRIDGE_PROTOCOL_VERSION, CloseCode, newNonce, type PluginKey, proofFor } from "@pixelwright/core";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { BridgeServer } from "../src/bridge/bridge-server.ts";
import { OwnerClient } from "../src/bridge/owner-client.ts";
import { PairingCodes } from "../src/bridge/pairing-codes.ts";
import { PluginBridge } from "../src/bridge/plugin-bridge.ts";
import { FilePluginKeys } from "../src/bridge/plugin-keys.ts";
import { PEER_PATH, PEER_PROTOCOL_VERSION } from "../src/constants/bridge.ts";
import type { PluginKeys } from "../src/types/bridge.ts";
import { connectPlugin, memoryKeys, pluginInfo, rawPlugin, TEST_KEY } from "./helpers/fake-plugin.ts";
import { freePort } from "./helpers/free-port.ts";

const token = "t".repeat(43);
const logger = pino({ level: "silent" });
const log = () => {};
const cleanup: (() => unknown)[] = [];

const server = (port: number, keys: PluginKeys = memoryKeys(TEST_KEY), pairing?: PairingCodes) =>
  new BridgeServer({
    port,
    token,
    pluginOrigins: ["null"],
    serverVersion: "test",
    keys,
    ...(pairing === undefined ? {} : { pairing }),
  });

/** A bridge.json the way the first process writes it, for keys shared between processes. */
async function bridgeFile(port: number): Promise<string> {
  const file = join(await mkdtemp(join(tmpdir(), "pixelwright-peer-")), "bridge.json");

  await writeFile(
    file,
    `${JSON.stringify({
      version: 1,
      port,
      token,
    })}\n`,
    { mode: 0o600 },
  );

  return file;
}

async function bridgeOn(port: number, keys?: PluginKeys, pairing?: PairingCodes): Promise<PluginBridge> {
  const bridge = await PluginBridge.connect(
    server(port, keys, pairing),
    new OwnerClient({
      port,
      token,
      log,
    }),
    {
      port,
      logger,
    },
  );

  cleanup.push(() => bridge.close());

  return bridge;
}

async function until(check: () => boolean, ms = 5_000): Promise<void> {
  const deadline = Date.now() + ms;

  while (!check()) {
    if (Date.now() > deadline) {
      throw new Error("condition not met in time");
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** A peer that speaks the handshake by hand, as a newer Pixelwright would: resolves with the code the owner closed it with. */
function handPeer(port: number, hello: { protocol: number; pluginProtocol?: number }, secret = token): Promise<number> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${PEER_PATH}`);
    const nonce = newNonce();

    socket.on("open", () =>
      socket.send(
        JSON.stringify({
          type: "peer_hello",
          nonce,
          ...hello,
        }),
      ),
    );
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as { type: string; nonce: string };

      if (message.type === "peer_challenge") {
        socket.send(
          JSON.stringify({
            type: "peer_auth",
            proof: proofFor(secret, "peer", message.nonce, nonce),
          }),
        );
      }
    });
    socket.on("close", (code) => resolve(code));
    cleanup.push(() => socket.close());
  });
}

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close();
  }
});

describe("peers", () => {
  it("lets a second process reach the owner's plugins", async () => {
    const port = await freePort();
    const owner = await bridgeOn(port);
    const peer = await bridgeOn(port);
    const plugin = await connectPlugin(port, pluginInfo());

    cleanup.push(() => plugin.socket.close());
    expect(owner.status().role).toBe("owner");
    expect(peer.status().role).toBe("peer");
    await until(() => peer.plugins().length === 1);
    await expect(peer.request("ping", null)).resolves.toEqual({ op: "ping" });
  });

  it("refuses a peer with the wrong token", async () => {
    const port = await freePort();
    const owner = server(port);

    await owner.listen();
    cleanup.push(() => owner.close());
    await expect(
      new OwnerClient({
        port,
        token: "x".repeat(43),
        log,
      }).join(() => {}),
    ).resolves.toBe(false);
  });

  it("takes the port over when the owner goes away", async () => {
    const port = await freePort();
    const owner = await bridgeOn(port);
    const peer = await bridgeOn(port);

    expect(peer.status().role).toBe("peer");
    await owner.close();
    await until(() => peer.status().role === "owner");
  });

  it("stays up when the port is held by a program that is not Pixelwright", async () => {
    const port = await freePort();
    const squatter = createServer((_request, response) => response.end("hi"));

    squatter.listen(port, "127.0.0.1");
    await once(squatter, "listening");
    cleanup.push(() => new Promise((resolve) => squatter.close(resolve)));

    const bridge = await bridgeOn(port);

    expect(bridge.status()).toMatchObject({
      role: "unavailable",
      hint: expect.stringContaining("not Pixelwright"),
    });
    await expect(bridge.request("ping", null)).rejects.toMatchObject({ code: "PLUGIN_NOT_CONNECTED" });
  });

  it("shows the pairing code in a peer session's status", async () => {
    const port = await freePort();
    const owner = await bridgeOn(port);
    const peer = await bridgeOn(port);
    const waiting = await rawPlugin(port, null);

    cleanup.push(() => waiting.socket.close());
    await waiting.next("pairing_required");
    await until(() => peer.pairing() !== null);
    expect(peer.pairing()?.code).toBe(owner.pairing()?.code);
    expect(peer.status().hint).toContain(owner.pairing()?.code ?? "no code");
  });

  it("keeps a peer's pairing code current when the code expires and when its tries run out", async () => {
    const port = await freePort();

    await bridgeOn(port, undefined, new PairingCodes({ ttlMs: 300 }));

    const peer = await bridgeOn(port);
    const waiting = await rawPlugin(port, null);

    cleanup.push(() => waiting.socket.close());
    await waiting.next("pairing_required");
    await until(() => peer.pairing()?.code !== null && peer.pairing() !== null);

    const first = peer.pairing()?.code;

    await until(() => peer.pairing()?.code !== first && peer.pairing()?.code !== null);

    for (let index = 0; index < 5; index += 1) {
      waiting.send({
        type: "pair",
        code: "999999",
      });
      await waiting.next("pairing_required");
    }

    await until(() => peer.pairing()?.lockedUntil !== null);
  });

  it("never sends the token to a program squatting on the port", async () => {
    const port = await freePort();
    const seen: string[] = [];
    const squatter = new WebSocketServer({
      port,
      host: "127.0.0.1",
    });

    squatter.on("connection", (socket, request) => {
      seen.push(JSON.stringify(request.headers));
      socket.on("message", (data) => {
        seen.push(data.toString());
        socket.send(
          JSON.stringify({
            type: "peer_challenge",
            nonce: newNonce(),
            proof: "0".repeat(64),
          }),
        );
      });
    });
    await once(squatter, "listening");
    cleanup.push(() => new Promise((resolve) => squatter.close(resolve)));
    await expect(
      new OwnerClient({
        port,
        token,
        log,
      }).join(() => {}),
    ).resolves.toBe(false);
    expect(seen.join("\n")).not.toContain(token);
    expect(seen.some((entry) => entry.includes("peer_auth"))).toBe(false);
  });

  it("does not join a program on the port that skips the challenge and only claims a status", async () => {
    const port = await freePort();
    const squatter = new WebSocketServer({
      port,
      host: "127.0.0.1",
    });

    squatter.on("connection", (socket) => {
      socket.send(
        JSON.stringify({
          type: "plugin_status",
          plugins: [],
          pairing: {
            code: "424242",
            expiresAt: Date.now() + 60_000,
            lockedUntil: null,
            waiting: 1,
          },
        }),
      );
    });
    await once(squatter, "listening");
    cleanup.push(() => new Promise((resolve) => squatter.close(resolve)));

    const client = new OwnerClient({
      port,
      token,
      log,
    });

    await expect(client.join(() => {})).resolves.toBe(false);
    expect(client.pairing()).toBeNull();
  });

  it("hands the port to a newer Pixelwright server that joins it, and switches its own bridge off", async () => {
    const port = await freePort();
    const owner = await bridgeOn(port);
    const plugin = await connectPlugin(port, pluginInfo());

    await until(() => owner.plugins().length === 1);
    await expect(
      handPeer(port, {
        protocol: PEER_PROTOCOL_VERSION,
        pluginProtocol: BRIDGE_PROTOCOL_VERSION + 1,
      }),
    ).resolves.toBe(CloseCode.HandedOver);
    // The plugin is let go to reconnect, and the port is free for the newer server.
    await expect(plugin.closed).resolves.toBe(CloseCode.GoingAway);

    const next = server(port);

    cleanup.push(() => next.close());
    await expect(next.listen()).resolves.toBe(port);
    expect(owner.status()).toMatchObject({
      role: "handedOver",
      hint: expect.stringContaining("/mcp"),
    });
    await expect(owner.request("ping", null)).rejects.toThrow(/newer Pixelwright server/);
  });

  it("hands the port over to a server that speaks a newer peer protocol too", async () => {
    const port = await freePort();

    await bridgeOn(port);
    await expect(handPeer(port, { protocol: PEER_PROTOCOL_VERSION + 1 })).resolves.toBe(CloseCode.HandedOver);
  });

  it("keeps the port when a newer hello cannot prove the token", async () => {
    const port = await freePort();
    const owner = await bridgeOn(port);

    await expect(
      handPeer(
        port,
        {
          protocol: PEER_PROTOCOL_VERSION,
          pluginProtocol: BRIDGE_PROTOCOL_VERSION + 1,
        },
        "x".repeat(43),
      ),
    ).resolves.toBe(CloseCode.Unauthorized);
    expect(owner.status().role).toBe("owner");
  });

  it("takes the port at once when an older owner hands it over", async () => {
    const port = await freePort();
    const older = createServer();
    const sockets = new WebSocketServer({ noServer: true });

    // An owner that proves the token, then gives the port up as soon as the newer peer proved it too.
    older.on("upgrade", (request, stream, head) =>
      sockets.handleUpgrade(request, stream, head, (socket) => {
        let peerNonce = "";
        const ownerNonce = newNonce();

        socket.on("message", (data) => {
          const message = JSON.parse(data.toString()) as { type: string; nonce: string };

          if (message.type === "peer_hello") {
            peerNonce = message.nonce;
            socket.send(
              JSON.stringify({
                type: "peer_challenge",
                nonce: ownerNonce,
                proof: proofFor(token, "owner", peerNonce, ownerNonce),
              }),
            );
          } else if (message.type === "peer_auth") {
            older.close();
            socket.close(CloseCode.HandedOver, "a newer Pixelwright server takes the bridge");
          }
        });
      }),
    );
    older.listen(port, "127.0.0.1");
    await once(older, "listening");
    cleanup.push(() => new Promise((resolve) => sockets.close(resolve)));

    const bridge = await bridgeOn(port);

    expect(bridge.status().role).toBe("owner");
  });

  it("honours a key the previous owner stored", async () => {
    const port = await freePort();
    const file = await bridgeFile(port);
    const first = await bridgeOn(port, new FilePluginKeys(file));
    const waiting = await rawPlugin(port, null);

    await waiting.next("pairing_required");
    waiting.send({
      type: "pair",
      code: first.pairing()?.code,
    });

    const { key } = (await waiting.next("paired")) as { key: PluginKey };

    waiting.socket.close();

    const second = await bridgeOn(port, new FilePluginKeys(file));

    expect(second.status().role).toBe("peer");
    await first.close();
    await until(() => second.status().role === "owner");

    const plugin = await connectPlugin(port, pluginInfo(), { key });

    cleanup.push(() => plugin.socket.close());
    await until(() => second.plugins().length === 1);
  });
});
