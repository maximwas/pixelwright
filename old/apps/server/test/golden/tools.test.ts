import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { memoryFiles } from "../../src/assets/written-files.ts";
import { memoryBaselines } from "../../src/baselines/baseline-store.ts";
import { SeenDesigns } from "../../src/baselines/seen-designs.ts";
import { createMcpServer } from "../../src/mcp/mcp-server.ts";
import { PluginClient } from "../../src/plugin/plugin-client.ts";
import { ProjectFolder } from "../../src/project/project-folder.ts";
import type { BridgeView } from "../../src/types/mcp.ts";

const unused = () => {
  throw new Error("listing tools needs no plugin");
};

const BRIDGE: BridgeView = {
  status: unused,
  plugins: unused,
  pairing: unused,
  request: unused,
};

/**
 * Every tool as a client lists it (name, title, description, input and output schemas, annotations), as the server
 * registered it before the rewrite. A rewrite must reproduce it byte for byte; a deliberate change updates this file in
 * the same commit, with the reason.
 */
describe("golden tool contract", () => {
  it("keeps every tool as clients list it", async () => {
    const server = createMcpServer({
      bridge: BRIDGE,
      plugin: new PluginClient(BRIDGE),
      version: "0.0.0-golden",
      files: memoryFiles(),
      projectRoot: "/golden",
      project: new ProjectFolder("/golden"),
      support: { due: async () => null },
      baselines: memoryBaselines(),
      seen: new SeenDesigns(),
    });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const client = new Client({
      name: "golden",
      version: "0.0.0",
    });

    await server.connect(serverSide);
    await client.connect(clientSide);

    try {
      const { tools } = await client.listTools();

      await expect(`${JSON.stringify(tools, null, 2)}\n`).toMatchFileSnapshot("__golden__/tools.json");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
