import { mkdtempSync } from "node:fs";
import { createServer, type OutgoingHttpHeaders, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { BridgeConfig } from "@/server/adapters/bridge/listener/bridge-config.ts";
import { BridgeListener } from "@/server/adapters/bridge/listener/bridge-listener.ts";
import { UpgradeGuard } from "@/server/adapters/bridge/listener/upgrade-guard.ts";
import { PairingCodes } from "@/server/adapters/bridge/plugin/pairing-codes.ts";
import { PluginConnections } from "@/server/adapters/bridge/plugin/plugin-connections.ts";
import { SessionRegistry } from "@/server/adapters/bridge/sessions/session-registry.ts";
import { AtomicJsonFile } from "@/server/adapters/files/atomic-json-file.ts";
import { PinoLogger } from "@/server/adapters/logging/pino-logger.ts";

const UPGRADE = {
  connection: "Upgrade",
  upgrade: "websocket",
  "sec-websocket-version": "13",
  "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
};

/** A BridgeListener built by hand on a free port, over a temp bridge.json, with every log line it writes. */
class ListenerProbe {
  readonly lines: Record<string, unknown>[] = [];
  readonly settings = {
    port: 0,
    pluginOrigins: [],
    configFile: join(mkdtempSync(join(tmpdir(), "pixelwright-listener-")), "bridge.json"),
  };

  readonly logger = new PinoLogger({ level: "info", file: "unused" }, [
    { write: (line: string) => this.lines.push(JSON.parse(line)) },
  ]);

  readonly clock = { now: () => Date.now() };
  readonly sessions = new SessionRegistry(new PairingCodes(this.clock, this.logger), this.logger);
  readonly listener = new BridgeListener(
    this.settings,
    new UpgradeGuard(this.settings),
    this.logger,
    new PluginConnections(
      new BridgeConfig(new AtomicJsonFile(this.logger), this.settings, this.clock),
      new PairingCodes(this.clock, this.logger),
      this.sessions,
      this.logger,
    ),
  );

  /** The status code an upgrade request with these headers gets. */
  upgrade(path: string, headers: OutgoingHttpHeaders): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
      request({ host: "127.0.0.1", port: this.listener.port(), path, headers: { ...UPGRADE, ...headers } })
        .on("response", (response) => resolve(response.statusCode))
        .on("upgrade", (response, socket) => {
          socket.destroy();
          resolve(response.statusCode);
        })
        .on("error", reject)
        .end();
    });
  }

  /** How the server closes a WebSocket it let in on `path` after it sent `frame`, if any. */
  close(path: string, frame?: unknown): Promise<{ code: number; reason: string }> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${this.listener.port()}${path}`,
        path.endsWith("/peer") ? {} : { origin: "null" },
      );

      socket
        .on("open", () => frame !== undefined && socket.send(JSON.stringify(frame)))
        .on("close", (code, reason) => resolve({ code, reason: String(reason) }))
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

  it("hands the plugin's window to the handshake, which turns a 0.7.0 hello away with 4426", async () => {
    const probe = await listening();
    const hello = { type: "hello", protocol: 5 };

    expect(await probe.close("/pixelwright/v1", hello)).toEqual({ code: 4426, reason: "protocol 6 required" });
    expect(probe.sessions.rejection()).toBeNull();
  });

  it("closes a peer 1011 until the peer handshake exists", async () => {
    const probe = await listening();

    expect(await probe.close("/pixelwright/v1/peer")).toEqual({
      code: 1011,
      reason: "the peer handshake is not built yet",
    });
  });

  it("refuses a foreign Host with 403, logs the reason, and keeps it for the status hint", async () => {
    const probe = await listening();

    expect(await probe.upgrade("/pixelwright/v1", { host: "example.com", origin: "null" })).toBe(403);
    expect(probe.sessions.rejection()).toEqual({ reason: "host", origin: "null" });
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
    expect(probe.sessions.rejection()).toEqual({ reason: "origin", origin: "https://evil.example" });
  });

  it("refuses an unknown path with 404 and a peer with an Origin with 403, neither kept for the hint", async () => {
    const probe = await listening();

    expect(await probe.upgrade("/other", { origin: "null" })).toBe(404);
    expect(await probe.upgrade("/pixelwright/v1/peer", { origin: "null" })).toBe(403);
    expect(probe.sessions.rejection()).toBeNull();
    expect(probe.lines.slice(1)).toMatchObject([
      { status: 404, reason: "path" },
      { status: 403, role: "peer", reason: "origin" },
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
