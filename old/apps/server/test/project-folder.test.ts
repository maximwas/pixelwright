import { pathToFileURL } from "node:url";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { describe, expect, it, vi } from "vitest";
import { memoryFiles } from "../src/assets/written-files.ts";
import { memoryBaselines } from "../src/baselines/baseline-store.ts";
import { SeenDesigns } from "../src/baselines/seen-designs.ts";
import { createMcpServer } from "../src/mcp/mcp-server.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import { ProjectFolder } from "../src/project/project-folder.ts";
import type { BridgeView } from "../src/types/mcp.ts";

const fileRoot = (path: string) => ({ uri: pathToFileURL(path).href });

const unused = () => {
  throw new Error("no plugin here");
};

const BRIDGE: BridgeView = {
  status: unused,
  plugins: unused,
  pairing: unused,
  request: unused,
};

/** The MCP server over a project folder, connected to a client that lists `roots` when it declares the capability. */
async function connected(project: ProjectFolder, roots: () => { uri: string }[] | null) {
  const server = createMcpServer({
    bridge: BRIDGE,
    plugin: new PluginClient(BRIDGE),
    version: "0.0.0-test",
    files: memoryFiles(),
    projectRoot: "/fallback",
    project,
    support: { due: async () => null },
    baselines: memoryBaselines(),
    seen: new SeenDesigns(),
  });
  const listed = roots();
  const client = new Client(
    {
      name: "test",
      version: "0.0.0",
    },
    listed === null ? {} : { capabilities: { roots: { listChanged: true } } },
  );

  if (listed !== null) {
    client.setRequestHandler("roots/list", async () => ({ roots: roots() ?? [] }));
  }

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

  await server.connect(serverSide);
  await client.connect(clientSide);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe("project folder over MCP", () => {
  it("is the root the client lists, and the new one once the client says its roots changed", async () => {
    const project = new ProjectFolder("/fallback");
    let root = "/work/a";
    const { client, close } = await connected(project, () => [fileRoot(root)]);

    try {
      expect(await project.root()).toBe("/work/a");

      root = "/work/b";
      await client.sendRootsListChanged();

      await vi.waitFor(async () => expect(await project.root()).toBe("/work/b"));
    } finally {
      await close();
    }
  });

  it("stays the fallback with a client that has no roots", async () => {
    const project = new ProjectFolder("/fallback");
    const { close } = await connected(project, () => null);

    try {
      expect(await project.root()).toBe("/fallback");
    } finally {
      await close();
    }
  });
});

describe("project folder", () => {
  it("resolves a relative path from the client's first file root, and leaves an absolute one as it is", async () => {
    const project = new ProjectFolder("/fallback");

    project.askRoots(async () => [
      { uri: "https://example.com/repo" },
      fileRoot("/work/site"),
      fileRoot("/work/other"),
    ]);

    expect(await project.root()).toBe("/work/site");
    expect(await project.resolve("src/assets")).toBe("/work/site/src/assets");
    expect(await project.resolve("../shots/a.png")).toBe("/work/shots/a.png");
    expect(await project.resolve("/elsewhere/shot.png")).toBe("/elsewhere/shot.png");
  });

  it("falls back to its own folder (CLAUDE_PROJECT_DIR, else the working directory) when the client gives no file root", async () => {
    const answers = [
      async () => null,
      async () => [],
      async () => [{ uri: "https://example.com/repo" }],
      async () => {
        throw new Error("roots/list is not supported");
      },
    ];

    for (const roots of answers) {
      const project = new ProjectFolder("/fallback");

      project.askRoots(roots);

      expect(await project.resolve("assets")).toBe("/fallback/assets");
    }

    expect(await new ProjectFolder("/fallback").resolve("assets")).toBe("/fallback/assets");
  });

  it("asks the client once, and again after its roots changed", async () => {
    const project = new ProjectFolder("/fallback");
    let asked = 0;
    let root = "/work/a";

    project.askRoots(async () => {
      asked++;

      return [fileRoot(root)];
    });

    expect([await project.root(), await project.resolve("x")]).toEqual(["/work/a", "/work/a/x"]);

    root = "/work/b";
    project.forget();

    expect(await project.root()).toBe("/work/b");
    expect(asked).toBe(2);
  });
});
