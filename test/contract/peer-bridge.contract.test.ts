import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import * as zod from "zod/mini";
import { PLUGIN_LINK } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { OWNER_ROUTER } from "@/server/adapters/bridge/owner-router/owner-router.ts";
import { SESSION_REGISTRY } from "@/server/adapters/bridge/sessions/session-registry/session-registry.tokens.ts";
import { ServerMain } from "@/server/main/server.main.ts";
import { type StatusOutput, StatusOutputSchema } from "@/server/tools/status/status.schema.ts";
import { Proof } from "@/shared/protocol/proof/proof.ts";

/** One server as the composition root wires it with the bridge on, in a home it may share with another, on a port. */
class Server {
  readonly home: string;
  readonly server: ServerMain;
  readonly client = new Client({
    name: "contract",
    version: "1.0.0",
  });

  constructor(
    home: string,
    port: number,
  ) {
    this.home = home;
    this.server = new ServerMain({
      home,
      logLevel: "silent",
      pluginBridge: true,
      bridgePort: port,
      pluginOrigins: [],
    });
  }

  async connect(): Promise<this> {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

    await this.server.listen();
    await this.server.endpoint().connect(serverSide);
    await this.client.connect(clientSide);

    return this;
  }

  async status(): Promise<StatusOutput> {
    const answer = await this.client.callTool({
      name: "status",
      arguments: {},
    });

    return zod.parse(StatusOutputSchema, answer.structuredContent);
  }

  async close(): Promise<void> {
    await this.client.close();
    await this.server.close();
  }
}

const servers: Server[] = [];

const started = async (
  home = mkdtempSync(join(tmpdir(), "pixelwright-peer-")),
  port = 0,
): Promise<Server> => {
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
    socket.on("open", () =>
      socket.send(
        JSON.stringify({
          type: "peer_hello",
          protocol,
          pluginProtocol: 6,
          nonce,
        }),
      ),
    );
    socket.on("message", (data) => {
      const challenge = JSON.parse(String(data)) as { nonce: string };

      socket.send(
        JSON.stringify({
          type: "peer_auth",
          proof: Proof.sign(token, "peer", challenge.nonce, nonce).hex(),
        }),
      );
    });
    socket.on("close", (code, reason) =>
      resolve({
        code,
        reason: String(reason),
      }),
    );
  });

const tokenOf = (home: string): string =>
  (JSON.parse(readFileSync(join(home, "bridge.json"), "utf8")) as { token: string }).token;

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("two servers on one bridge (S-030..S-034)", () => {
  it("makes the second server a peer of the first, showing its files and relaying its requests (S-032)", async () => {
    const owner = await started();
    const { port } = (await owner.status()).server;
    const peer = await started(owner.home, port);

    expect((await peer.status()).server).toMatchObject({
      role: "peer",
      port,
    });
    await expect(
      peer.server.container().get(PLUGIN_LINK).request({
        session: "gone",
        op: "ping",
        input: {},
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: "PLUGIN_NOT_CONNECTED" });
  });

  it("closes an older peer 4426 with the protocol it needs (S-034)", async () => {
    const owner = await started();
    const { port } = (await owner.status()).server;

    expect(await handPeer(port, tokenOf(owner.home), 2)).toEqual({
      code: 4426,
      reason: "peer protocol 3 required",
    });
  });

  it("hands the bridge to a newer peer after its proof; the old owner's tools ask for a restart (S-034, X-010)", async () => {
    const owner = await started();
    const { port } = (await owner.status()).server;

    expect((await handPeer(port, tokenOf(owner.home), 4)).code).toBe(4410);
    expect((await owner.status()).server.role).toBe("handedOver");

    const answer = await owner.client.callTool({
      name: "selection_get",
      arguments: {},
    });

    expect(answer.isError).toBe(true);
    expect(JSON.stringify(answer.content)).toContain("restart Pixelwright in this MCP client (/mcp in Claude Code)");
  });

  it("pushes the owner's status to its peers on every change (S-033)", async () => {
    const owner = await started();
    const container = owner.server.container();
    const statuses = container.get(OWNER_ROUTER).statuses();

    expect((await statuses.next()).value).toEqual({
      files: [],
      pairing: null,
    });

    container.get(SESSION_REGISTRY).wait({});

    expect((await statuses.next()).value).toMatchObject({ pairing: { waiting: 1 } });
    await statuses.return(undefined);
  });

  it("still starts an owner when bridge.json is broken (S-014)", async () => {
    const home = mkdtempSync(join(tmpdir(), "pixelwright-peer-"));

    writeFileSync(join(home, "bridge.json"), "{ not json");

    expect((await (await started(home)).status()).server.role).toBe("owner");
  });
});
