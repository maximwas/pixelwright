import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeServer } from "../src/bridge/bridge-server.ts";
import { connectPlugin, pluginInfo } from "./helpers/fake-plugin.ts";

const servers: BridgeServer[] = [];

async function startServer(requestTimeoutMs = 1_000) {
  const server = new BridgeServer({
    port: 0,
    token: "t".repeat(43),
    pluginOrigins: ["null"],
    serverVersion: "test",
    requestTimeoutMs,
  });
  const port = await server.listen();

  servers.push(server);
  expect(port).not.toBeNull();

  return {
    server,
    port: port ?? 0,
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("BridgeServer", () => {
  it("lists a plugin after its hello and relays requests to it", async () => {
    const { server, port } = await startServer();
    const changed = once(server, "changed");
    const plugin = await connectPlugin(port, pluginInfo());

    await changed;
    expect(server.plugins()).toMatchObject([
      {
        info: { file: { name: "Positivus" } },
        active: true,
      },
    ]);
    await expect(server.request("ping", null)).resolves.toEqual({ op: "ping" });
    expect(plugin.received[0]).toMatchObject({
      type: "hello_ack",
      server: { name: "pixelwright" },
    });
  });

  it("closes a plugin of another protocol version with 4426", async () => {
    const { server, port } = await startServer();
    const plugin = await connectPlugin(port, pluginInfo(), { protocol: 99 });

    expect(await plugin.closed).toBe(4426);
    expect(server.plugins()).toEqual([]);
  });

  it("times out a request the plugin never answers", async () => {
    const { server, port } = await startServer(100);
    const changed = once(server, "changed");

    await connectPlugin(port, pluginInfo(), { answer: null });
    await changed;
    await expect(server.request("ping", null)).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("sends requests to the file whose window came to the front last", async () => {
    const { server, port } = await startServer();
    let changed = once(server, "changed");
    const a = await connectPlugin(
      port,
      pluginInfo({
        instanceId: "a",
        file: {
          name: "A",
          key: null,
        },
      }),
      {
        answer: () => "A",
      },
    );

    await changed;
    changed = once(server, "changed");

    const bInfo = pluginInfo({
      instanceId: "b",
      file: {
        name: "B",
        key: null,
      },
      visible: false,
    });
    const b = await connectPlugin(port, bInfo, { answer: () => "B" });

    await changed;
    expect(await server.request("ping", null)).toBe("A");

    changed = once(server, "changed");
    b.sendInfo({
      ...bInfo,
      visible: true,
    });
    await changed;
    expect(server.plugins().find((plugin) => plugin.active)?.info.file.name).toBe("B");
    expect(await server.request("ping", null)).toBe("B");

    changed = once(server, "changed");
    a.sendInfo(
      pluginInfo({
        instanceId: "a",
        file: {
          name: "A",
          key: null,
        },
      }),
    );
    await changed;
    expect(await server.request("ping", null)).toBe("A");
  });

  it("replaces the old socket when the same plugin window says hello again", async () => {
    const { server, port } = await startServer();
    const changed = once(server, "changed");
    const first = await connectPlugin(port, pluginInfo());

    await changed;
    await connectPlugin(port, pluginInfo());
    expect(await first.closed).toBe(4409);
    expect(server.plugins()).toHaveLength(1);
  });

  it("fails a request when no plugin, or no such session, is connected", async () => {
    const { server } = await startServer();

    await expect(server.request("ping", null)).rejects.toMatchObject({ code: "PLUGIN_NOT_CONNECTED" });
    await expect(server.request("ping", null, { session: "nope" })).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
  });
});
