import { once } from "node:events";
import { createServer } from "node:http";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeServer } from "../src/bridge/bridge-server.ts";
import { OwnerClient } from "../src/bridge/owner-client.ts";
import { PluginBridge } from "../src/bridge/plugin-bridge.ts";
import { connectPlugin, memoryKeys, pluginInfo, TEST_KEY } from "./helpers/fake-plugin.ts";
import { freePort } from "./helpers/free-port.ts";

const token = "t".repeat(43);
const logger = pino({ level: "silent" });
const log = () => {};
const cleanup: (() => unknown)[] = [];

const server = (port: number) =>
  new BridgeServer({
    port,
    token,
    pluginOrigins: ["null"],
    serverVersion: "test",
    keys: memoryKeys(TEST_KEY),
  });

async function bridgeOn(port: number): Promise<PluginBridge> {
  const bridge = await PluginBridge.connect(
    server(port),
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
});
