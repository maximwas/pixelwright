import { createServer, type OutgoingHttpHeaders, request } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { PinoLogger } from "../../logging/pino-logger/pino-logger.ts";
import { UpgradeGuard } from "../upgrade-guard/upgrade-guard.ts";
import { BridgeListener } from "./bridge-listener.ts";

const UPGRADE = {
  connection: "Upgrade",
  upgrade: "websocket",
  "sec-websocket-version": "13",
  "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
};

/** A BridgeListener built by hand on a free port, with every log line it writes. */
class ListenerProbe {
  readonly lines: Record<string, unknown>[] = [];
  readonly settings = {
    port: 0,
    pluginOrigins: [],
    configFile: "unused",
  };

  readonly listener = new BridgeListener(
    this.settings,
    new UpgradeGuard(this.settings),
    new PinoLogger(
      {
        level: "info",
        file: "unused",
      },
      [{ write: (line: string) => this.lines.push(JSON.parse(line)) }],
    ),
  );

  /** The status code an upgrade request with these headers gets. */
  upgrade(
    path: string,
    headers: OutgoingHttpHeaders,
  ): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
      request({
        host: "127.0.0.1",
        port: this.listener.port(),
        path,
        headers: {
          ...UPGRADE,
          ...headers,
        },
      })
        .on("response", (response) => resolve(response.statusCode))
        .on("upgrade", (response, socket) => {
          socket.destroy();
          resolve(response.statusCode);
        })
        .on("error", reject)
        .end();
    });
  }

  /** How the server closes a WebSocket it let in. */
  closeCode(origin: string): Promise<number> {
    return new Promise((resolve, reject) => {
      new WebSocket(`ws://127.0.0.1:${this.listener.port()}/pixelwright/v1`, { origin })
        .on("close", (code) => resolve(code))
        .on("error", reject);
    });
  }
}

const probes: ListenerProbe[] = [];

const listening = async (): Promise<ListenerProbe> => {
  const probe = new ListenerProbe();

  probes.push(probe);
  await probe.listener.listen();

  return probe;
};

afterEach(async () => {
  await Promise.all(probes.splice(0).map((probe) => probe.listener.close()));
});

describe("BridgeListener", () => {
  it("listens on 127.0.0.1 and says where", async () => {
    const probe = await listening();

    expect(probe.listener.port()).toBeGreaterThan(0);
    expect(probe.lines).toMatchObject([
      {
        level: 30,
        component: "bridge",
        msg: "bridge listening",
        url: `ws://127.0.0.1:${probe.listener.port()}/pixelwright/v1`,
      },
    ]);
  });

  it("answers plain HTTP with 426 Upgrade Required", async () => {
    const probe = await listening();
    const response = await fetch(`http://127.0.0.1:${probe.listener.port()}/pixelwright/v1`);

    expect(response.status).toBe(426);
    expect(await response.text()).toBe("Upgrade Required");
  });

  it("lets the plugin's window upgrade, then closes it 1011 until the handshake exists", async () => {
    const probe = await listening();

    expect(await probe.closeCode("null")).toBe(1011);
    expect(probe.listener.rejection()).toBeNull();
  });

  it("refuses a foreign Host with 403, logs the reason, and keeps it for the status hint", async () => {
    const probe = await listening();

    expect(
      await probe.upgrade("/pixelwright/v1", {
        host: "example.com",
        origin: "null",
      }),
    ).toBe(403);
    expect(probe.listener.rejection()).toEqual({
      reason: "host",
      origin: "null",
    });
    expect(probe.lines.at(-1)).toEqual(
      expect.objectContaining({
        level: 40,
        msg: "bridge refused an upgrade",
        status: 403,
        role: "plugin",
        reason: "host",
        origin: "null",
        host: "example.com",
      }),
    );
  });

  it("refuses a web page's Origin with 403 origin", async () => {
    const probe = await listening();

    expect(await probe.upgrade("/pixelwright/v1", { origin: "https://evil.example" })).toBe(403);
    expect(probe.listener.rejection()).toEqual({
      reason: "origin",
      origin: "https://evil.example",
    });
  });

  it("refuses an unknown path with 404 and a peer with an Origin with 403, neither kept for the hint", async () => {
    const probe = await listening();

    expect(await probe.upgrade("/other", { origin: "null" })).toBe(404);
    expect(await probe.upgrade("/pixelwright/v1/peer", { origin: "null" })).toBe(403);
    expect(probe.listener.rejection()).toBeNull();
    expect(probe.lines.slice(1)).toMatchObject([
      {
        status: 404,
        reason: "path",
      },
      {
        status: 403,
        role: "peer",
        reason: "origin",
      },
    ]);
  });

  it("frees the port when it closes, so another server can take it at once", async () => {
    const probe = await listening();
    const port = probe.listener.port();

    await probe.listener.close();

    const next = createServer();

    await new Promise<void>((resolve) => next.listen(port, "127.0.0.1", resolve));
    await new Promise((resolve) => next.close(resolve));
  });

  it("throws EADDRINUSE when another program holds the port", async () => {
    const first = await listening();
    const second = new ListenerProbe();

    second.settings.port = first.listener.port();

    await expect(second.listener.listen()).rejects.toMatchObject({ code: "EADDRINUSE" });
  });
});
