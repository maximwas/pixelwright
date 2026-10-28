import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import * as zod from "zod/mini";
import { PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import { OWNER_ROUTER } from "@/server/adapters/bridge/owner/owner-router.ts";
import { PAIRING_CODES } from "@/server/adapters/bridge/plugin/pairing-codes.ts";
import { BridgeSession } from "@/server/adapters/bridge/sessions/bridge-session.ts";
import { SESSION_REGISTRY, type SessionRegistry } from "@/server/adapters/bridge/sessions/session-registry.ts";
import { ServerMain } from "@/server/main/server.main.ts";
import { type StatusOutput, StatusOutputSchema } from "@/server/tools/status/status.schema.ts";
import { Proof } from "@/shared/protocol/proof.ts";

/** One server as the composition root wires it with the bridge on, in a home it may share with another, on a port. */
class Server {
  readonly home: string;
  readonly server: ServerMain;
  readonly client = new Client({ name: "contract", version: "1.0.0" });

  constructor(home: string, port: number) {
    this.home = home;
    this.server = new ServerMain({ home, logLevel: "silent", pluginBridge: true, bridgePort: port, pluginOrigins: [] });
  }

  async connect(): Promise<this> {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

    await this.server.listen();
    await this.server.endpoint().connect(serverSide);
    await this.client.connect(clientSide);

    return this;
  }

  async status(): Promise<StatusOutput> {
    const answer = await this.client.callTool({ name: "status", arguments: {} });

    return zod.parse(StatusOutputSchema, answer.structuredContent);
  }

  async close(): Promise<void> {
    await this.client.close();
    await this.server.close();
  }
}

const servers: Server[] = [];

const started = async (home = mkdtempSync(join(tmpdir(), "pixelwright-peer-")), port = 0): Promise<Server> => {
  const server = new Server(home, port);

  servers.push(server);

  return server.connect();
};

/** A peer written by hand: hello with `protocol`, and the token proof back when the owner proved it first. */
const handPeer = (
  port: number,
  token: string,
  protocol: number,
): Promise<{ code: number; reason: string }> =>
  new Promise((resolve) => {
    const nonce = randomBytes(16).toString("hex");
    const socket = new WebSocket(`ws://127.0.0.1:${port}/pixelwright/v1/peer`);

    socket.on("error", () => undefined);
    socket.on("open", () => socket.send(JSON.stringify({ type: "peer_hello", protocol, pluginProtocol: 6, nonce })));
    socket.on("message", (data) => {
      const challenge = JSON.parse(String(data)) as { nonce: string };

      socket.send(
        JSON.stringify({ type: "peer_auth", proof: Proof.sign(token, "peer", challenge.nonce, nonce).hex() }),
      );
    });
    socket.on("close", (code, reason) => resolve({ code, reason: String(reason) }));
  });

const tokenOf = (home: string): string =>
  (JSON.parse(readFileSync(join(home, "bridge.json"), "utf8")) as { token: string }).token;

/** A plugin session on the owner whose plugin never answers: its socket drops every frame. */
const silentSession = (registry: SessionRegistry): BridgeSession =>
  new BridgeSession(
    { send: () => undefined, close: () => undefined },
    {
      instanceId: "window-1",
      pluginVersion: "0.8.0",
      editorType: "figma",
      file: { name: "Test MCP", key: null },
      page: { id: "0:1", name: "Start here" },
      allowEdits: false,
      visible: true,
    },
    registry,
  );

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("two servers on one bridge (S-030..S-034)", () => {
  it("makes the second server a peer of the first, showing its files and relaying its requests (S-032)", async () => {
    const owner = await started();
    const { port } = (await owner.status()).server;
    const peer = await started(owner.home, port);

    expect((await peer.status()).server).toMatchObject({ role: "peer", port });
    await expect(
      peer.server.container().get(PLUGIN_LINK).request({ session: "gone", op: "ping", input: {}, timeoutMs: 1_000 }),
    ).rejects.toMatchObject({ code: "PLUGIN_NOT_CONNECTED" });
  });

  it("gives a peer the owner's TIMEOUT, worded for the op, before the peer's own deadline (S-032)", async () => {
    const owner = await started();
    const { port } = (await owner.status()).server;
    const peer = await started(owner.home, port);
    const registry = owner.server.container().get(SESSION_REGISTRY);
    const session = silentSession(registry);

    registry.add(session);

    // The owner gives up at 100 ms plus its 1 s grace; the peer would at 6.1 s.
    await expect(
      peer.server.container().get(PLUGIN_LINK).request({ session: session.id, op: "ping", input: {}, timeoutMs: 100 }),
    ).rejects.toMatchObject({
      code: "TIMEOUT",
      message:
        "ping: the plugin did not answer in 0.1 s; bring its file to the front in Figma (a background tab is slowed) and try again",
    });
  });

  it("closes an older peer 4426 with the protocol it needs (S-034)", async () => {
    const owner = await started();
    const { port } = (await owner.status()).server;

    expect(await handPeer(port, tokenOf(owner.home), 3)).toEqual({ code: 4426, reason: "peer protocol 4 required" });
  });

  it("hands the bridge to a newer peer after its proof; the old owner's tools ask for a restart (S-034, X-010)", async () => {
    const owner = await started();
    const { port } = (await owner.status()).server;

    expect((await handPeer(port, tokenOf(owner.home), 5)).code).toBe(4410);
    expect((await owner.status()).server.role).toBe("handedOver");

    const answer = await owner.client.callTool({ name: "selection_get", arguments: {} });

    expect(answer.isError).toBe(true);
    expect(JSON.stringify(answer.content)).toContain("restart Pixelwright in this MCP client (/mcp in Claude Code)");
  });

  it("pushes the owner's files to its peers on every change (S-033)", async () => {
    const owner = await started();
    const container = owner.server.container();
    const registry = container.get(SESSION_REGISTRY);
    const statuses = container.get(OWNER_ROUTER).statuses();

    expect((await statuses.next()).value).toEqual({ files: [] });

    registry.add(silentSession(registry));

    expect((await statuses.next()).value).toMatchObject({ files: [{ name: "Test MCP" }] });
    await statuses.return(undefined);
  });

  it("mints no code when a window starts to wait or a peer joins: only status does (S-020)", async () => {
    const owner = await started();
    const { port } = (await owner.status()).server;
    const container = owner.server.container();

    container.get(SESSION_REGISTRY).wait({});
    await started(owner.home, port);

    // No code in force: a waiting window is told none has time left.
    expect(container.get(PAIRING_CODES).prompt("no_key").expiresInMs).toBe(0);
  });

  it("asks the owner for its pairing on each status, so wrong codes show at once (S-020, S-021)", async () => {
    const owner = await started();
    const { port } = (await owner.status()).server;
    const peer = await started(owner.home, port);
    const container = owner.server.container();
    const codes = container.get(PAIRING_CODES);

    container.get(SESSION_REGISTRY).wait({});

    expect((await peer.status()).pairing).toMatchObject({
      code: expect.any(String),
      lockedForSeconds: null,
      waiting: 1,
    });

    // Five wrong codes spend the code's tries and pause pairing; the session registry does not change.
    for (const typed of ["1", "2", "3", "4", "5"]) {
      codes.check(typed);
    }

    expect((await peer.status()).pairing).toMatchObject({ code: null, lockedForSeconds: 30, waiting: 1 });
  });

  it("still starts an owner when bridge.json is broken (S-014)", async () => {
    const home = mkdtempSync(join(tmpdir(), "pixelwright-peer-"));

    writeFileSync(join(home, "bridge.json"), "{ not json");

    expect((await (await started(home)).status()).server.role).toBe("owner");
  });
});
