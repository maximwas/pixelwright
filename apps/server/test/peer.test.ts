import { once } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newNonce, type PluginKey } from "@pixelwright/core";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { BridgeServer } from "../src/bridge/bridge-server.ts";
import { OwnerClient } from "../src/bridge/owner-client.ts";
import { PluginBridge } from "../src/bridge/plugin-bridge.ts";
import { FilePluginKeys } from "../src/bridge/plugin-keys.ts";
import type { PluginKeys } from "../src/types/bridge.ts";
import { connectPlugin, memoryKeys, pluginInfo, rawPlugin, TEST_KEY } from "./helpers/fake-plugin.ts";
import { freePort } from "./helpers/free-port.ts";

const token = "t".repeat(43);
const logger = pino({ level: "silent" });
const log = () => {};
const cleanup: (() => unknown)[] = [];

const server = (port: number, keys: PluginKeys = memoryKeys(TEST_KEY)) =>
  new BridgeServer({
    port,
    token,
    pluginOrigins: ["null"],
    serverVersion: "test",
    keys,
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

async function bridgeOn(port: number, keys?: PluginKeys): Promise<PluginBridge> {
  const bridge = await PluginBridge.connect(
    server(port, keys),
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
