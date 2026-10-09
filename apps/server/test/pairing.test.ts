import { once } from "node:events";
import { newKeyId, newNonce, newSecret, type PluginKey, proofFor } from "@pixelwright/core";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeServer } from "../src/bridge/bridge-server.ts";
import { PairingCodes } from "../src/bridge/pairing-codes.ts";
import { MAX_PENDING_PLUGINS } from "../src/constants/bridge.ts";
import type { PluginKeys } from "../src/types/bridge.ts";
import { memoryKeys, pluginInfo, rawPlugin } from "./helpers/fake-plugin.ts";

const servers: BridgeServer[] = [];

async function start(keys: PluginKeys, pairing?: PairingCodes) {
  const server = new BridgeServer({
    port: 0,
    token: "t".repeat(43),
    pluginOrigins: ["null"],
    serverVersion: "test",
    keys,
    ...(pairing === undefined ? {} : { pairing }),
  });
  const port = await server.listen();

  servers.push(server);

  return {
    server,
    port: port ?? 0,
  };
}

/** Codes 111111, 222222, … so a test knows the next code. */
const predictableCodes = () => {
  let digit = 0;

  return new PairingCodes({ randomDigits: () => String(++digit).repeat(6) });
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("pairing", () => {
  it("keeps an unpaired plugin out of plugins(), status and requests", async () => {
    const { server, port } = await start(memoryKeys());
    const plugin = await rawPlugin(
      port,
      null,
      pluginInfo({
        file: {
          name: "Secret client file",
          key: null,
        },
      }),
    );

    expect(await plugin.next("pairing_required")).toMatchObject({
      reason: "no_key",
      attemptsLeft: 5,
    });
    expect(server.plugins()).toEqual([]);
    expect(server.pairing()).toMatchObject({
      code: expect.stringMatching(/^\d{6}$/),
      waiting: 1,
    });
    expect(JSON.stringify(server.pairing())).not.toContain("Secret client file");
    await expect(server.request("ping", null)).rejects.toMatchObject({ code: "PLUGIN_NOT_CONNECTED" });
  });

  it("pairs a plugin that sends the code, stores its key and lets it in", async () => {
    const keys = memoryKeys();
    const { server, port } = await start(keys);
    const plugin = await rawPlugin(port, null);

    await plugin.next("pairing_required");
    plugin.send({
      type: "pair",
      code: server.pairing()?.code,
    });

    const { key } = (await plugin.next("paired")) as { key: PluginKey };

    await plugin.next("hello_ack");
    expect(keys.find(key.id)).toEqual(key);
    expect(server.plugins()).toHaveLength(1);
    expect(server.pairing()).toBeNull();
  });

  it("gives a guesser five tries, then locks pairing until a pause passes", async () => {
    let now = 1_000;
    let digit = 0;
    const pairing = new PairingCodes({
      now: () => now,
      randomDigits: () => String(++digit).repeat(6),
      cooldownMs: 60_000,
    });
    const { server, port } = await start(memoryKeys(), pairing);
    const plugin = await rawPlugin(port, null);

    await plugin.next("pairing_required");
    expect(server.pairing()?.code).toBe("111111");

    for (let left = 4; left >= 1; left -= 1) {
      plugin.send({
        type: "pair",
        code: "999999",
      });
      expect(await plugin.next("pairing_required")).toMatchObject({
        reason: "wrong_code",
        attemptsLeft: left,
      });
    }

    plugin.send({
      type: "pair",
      code: "999999",
    });
    expect(await plugin.next("pairing_required")).toMatchObject({
      reason: "locked",
      expiresInMs: 60_000,
    });
    plugin.send({
      type: "pair",
      code: "111111",
    });
    expect(await plugin.next("pairing_required")).toMatchObject({ reason: "locked" });
    expect(server.pairing()).toMatchObject({
      code: null,
      lockedUntil: 61_000,
    });
    expect(server.plugins()).toEqual([]);
    now = 61_000;
    expect(server.pairing()?.code).toBe("222222");
  });

  it("lets a plugin with a known key in by challenge-response, after the server proves itself", async () => {
    const key = {
      id: newKeyId(),
      secret: newSecret(),
    };
    const { server, port } = await start(memoryKeys(key));
    const plugin = await rawPlugin(port, key.id);
    const challenge = (await plugin.next("challenge")) as { nonce: string; proof: string };

    expect(challenge.proof).toBe(proofFor(key.secret, "server", plugin.nonce, challenge.nonce));

    const changed = once(server, "changed");

    plugin.send({
      type: "auth",
      proof: proofFor(key.secret, "plugin", challenge.nonce, plugin.nonce),
    });
    await plugin.next("hello_ack");
    await changed;
    expect(server.plugins()).toHaveLength(1);
  });

  it("closes 4401 on a wrong proof", async () => {
    const key = {
      id: newKeyId(),
      secret: newSecret(),
    };
    const { server, port } = await start(memoryKeys(key));
    const plugin = await rawPlugin(port, key.id);
    const challenge = (await plugin.next("challenge")) as { nonce: string };

    plugin.send({
      type: "auth",
      proof: proofFor(newSecret(), "plugin", challenge.nonce, plugin.nonce),
    });
    expect(await plugin.closed).toBe(4401);
    expect(server.plugins()).toEqual([]);
  });

  it("asks a plugin whose key the server forgot to pair again", async () => {
    const { port } = await start(memoryKeys());
    const plugin = await rawPlugin(port, newKeyId());

    expect(await plugin.next("pairing_required")).toMatchObject({ reason: "unknown_key" });
  });

  it("keeps at most a few plugins waiting to be paired", async () => {
    const { port } = await start(memoryKeys());

    for (let index = 0; index < MAX_PENDING_PLUGINS; index += 1) {
      const waiting = await rawPlugin(port, null, pluginInfo({ instanceId: `waiting-${index}` }));

      await waiting.next("pairing_required");
    }

    const extra = await rawPlugin(port, null, pluginInfo({ instanceId: newNonce().slice(0, 12) }));

    expect(await extra.closed).toBe(4429);
  });
});
