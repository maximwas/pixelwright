import { mkdtempSync, statSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { ServerMain } from "@/server/main/server.main.ts";
import { type StatusOutput, StatusOutputSchema } from "@/server/tools/status/status.schema.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/** The server as the composition root wires it with the bridge on, in a temp home, on a free or a given port. */
class OwnerClient {
  readonly home = mkdtempSync(join(tmpdir(), "pixelwright-owner-"));
  readonly server: ServerMain;
  readonly client = new Client({ name: "contract", version: "1.0.0" });

  constructor(port = 0) {
    this.server = new ServerMain({
      home: this.home,
      logLevel: "silent",
      pluginBridge: true,
      bridgePort: port,
      pluginOrigins: [],
      projectDir: tmpdir(),
    });
  }

  async connect(): Promise<void> {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

    await this.server.listen();
    await this.server.endpoint().connect(serverSide);
    await this.client.connect(clientSide);
  }

  /** The answer, read by status's own output schema. */
  async status(): Promise<StatusOutput> {
    const answer = await this.client.callTool({ name: "status", arguments: {} });

    return zod.parse(StatusOutputSchema, answer.structuredContent);
  }

  async close(): Promise<void> {
    await this.client.close();
    await this.server.close();
  }
}

const owners: OwnerClient[] = [];

const connected = async (port?: number): Promise<OwnerClient> => {
  const owner = new OwnerClient(port);

  owners.push(owner);
  await owner.connect();

  return owner;
};

afterEach(async () => {
  await Promise.all(owners.splice(0).map((owner) => owner.close()));
});

describe("the owner bridge through the composition root", () => {
  it("owns the port: status shows role owner, its port, protocol 6, no file, and bridge.json is made private", async () => {
    const owner = await connected();
    const status = await owner.status();

    expect(status).toEqual({
      server: expect.objectContaining({ channel: CHANNEL.name, role: "owner", protocol: 6, port: expect.any(Number) }),
      files: [],
      probe: null,
      pairing: null,
      hint: `No Figma file is connected: open the file in Figma Desktop, run Plugins → Development → ${CHANNEL.pluginName}, and keep the plugin window open.`,
    });
    expect((statSync(join(owner.home, "bridge.json")).mode & 0o777).toString(8)).toBe("600");
  });

  it("names a refused plugin connection in the hint", async () => {
    const owner = await connected();
    const { server } = await owner.status();

    await new Promise((resolve, reject) => {
      request({
        host: "127.0.0.1",
        port: server.port,
        path: "/pixelwright/v1",
        headers: { connection: "Upgrade", upgrade: "websocket", origin: "https://evil.example" },
      })
        .on("response", resolve)
        .on("error", reject)
        .end();
    });

    expect((await owner.status()).hint).toBe(
      `A connection from origin https://evil.example was refused (origin): if it was not the ${CHANNEL.pluginName} plugin, ignore it.`,
    );
  });

  it("stays up when another program holds the port: unavailable, retrying, and the hint says why (S-014)", async () => {
    const holder = createServer();

    await new Promise<void>((resolve) => holder.listen(0, "127.0.0.1", resolve));

    const address = holder.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;

    try {
      const owner = await connected(port);

      expect(await owner.status()).toMatchObject({
        server: { role: "unavailable", port },
        hint: `Port ${port} is held by a program that is not Pixelwright: free it. This session keeps retrying.`,
      });
    } finally {
      await new Promise((resolve) => holder.close(resolve));
    }
  });
});
