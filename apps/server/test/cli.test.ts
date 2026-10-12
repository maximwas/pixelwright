import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addToCursor, clientConfigBlock, codexBlock } from "../src/cli/clients.ts";
import { installPlugin } from "../src/cli/plugin-files.ts";
import { setupText } from "../src/cli/setup-text.ts";
import { SERVER_INVOCATION } from "../src/constants/clients.ts";
import { parseCommand } from "../src/utils/cli-command.ts";
import { mergeMcpServer } from "../src/utils/mcp-config.ts";

describe("the command line", () => {
  it("is the MCP server for a client, the setup for a person at a terminal", () => {
    expect(parseCommand([], false)).toEqual({ kind: "mcp" });
    expect(parseCommand([], true)).toEqual({
      kind: "setup",
      print: false,
    });
    expect(parseCommand(["serve"], true)).toEqual({ kind: "mcp" });
    expect(parseCommand(["setup", "--print"], false)).toEqual({
      kind: "setup",
      print: true,
    });
    expect(parseCommand(["--version"], true)).toEqual({ kind: "version" });
    expect(parseCommand(["-h"], true)).toEqual({ kind: "help" });
    expect(parseCommand(["publish"], true)).toEqual({
      kind: "unknown",
      argument: "publish",
    });
    expect(parseCommand(["setup", "--force"], true)).toEqual({
      kind: "unknown",
      argument: "setup --force",
    });
  });
});

describe("adding the server to MCP clients", () => {
  const entry = {
    command: SERVER_INVOCATION.command,
    args: [...SERVER_INVOCATION.args],
  };

  it("merges it into a config, keeping the rest, and changes nothing when it is there already", () => {
    expect(mergeMcpServer(null, "pixelwright", entry)).toEqual({
      config: { mcpServers: { pixelwright: entry } },
      changed: true,
    });

    const other = {
      theme: "dark",
      mcpServers: { figma: { url: "http://127.0.0.1:3845/mcp" } },
    };
    const merged = mergeMcpServer(other, "pixelwright", entry);

    expect(merged.config).toEqual({
      theme: "dark",
      mcpServers: {
        figma: { url: "http://127.0.0.1:3845/mcp" },
        pixelwright: entry,
      },
    });
    expect(mergeMcpServer(merged.config, "pixelwright", entry).changed).toBe(false);
    expect(() => mergeMcpServer([], "pixelwright", entry)).toThrow(/JSON object/);
  });

  it("writes Cursor's config: a new one, an existing one with a backup, never an invalid one", async () => {
    const home = await mkdtemp(join(tmpdir(), "pixelwright-home-"));
    const file = join(home, ".cursor", "mcp.json");

    expect(await addToCursor(SERVER_INVOCATION, home)).toMatch(/^Added pixelwright to Cursor/);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ mcpServers: { pixelwright: entry } });
    expect(await addToCursor(SERVER_INVOCATION, home)).toMatch(/already/);

    await writeFile(file, JSON.stringify({ mcpServers: { other: { command: "x" } } }));
    await addToCursor(SERVER_INVOCATION, home);
    expect((await readdir(join(home, ".cursor"))).sort()).toEqual(["mcp.json", "mcp.json.bak"]);

    await writeFile(file, "{ broken");
    await expect(addToCursor(SERVER_INVOCATION, home)).rejects.toThrow(/not valid JSON/);
    expect(await readFile(file, "utf8")).toBe("{ broken");
  });

  it("gives Codex's TOML and other clients' JSON to paste", () => {
    expect(codexBlock(SERVER_INVOCATION)).toBe(
      '[mcp_servers.pixelwright]\ncommand = "npx"\nargs = ["-y", "pixelwright@latest"]',
    );
    expect(JSON.parse(clientConfigBlock(SERVER_INVOCATION))).toEqual({ mcpServers: { pixelwright: entry } });
  });
});

describe("the Figma plugin's files", () => {
  it("are copied where Figma Desktop can import the manifest from, replacing an older copy", async () => {
    const from = await mkdtemp(join(tmpdir(), "pixelwright-plugin-src-"));
    const to = join(await mkdtemp(join(tmpdir(), "pixelwright-home-")), "plugin");

    await mkdir(join(from, "build"));
    await writeFile(join(from, "manifest.json"), '{"name":"Pixelwright"}');
    await writeFile(join(from, "build", "main.js"), "main");
    await writeFile(join(from, "build", "ui.js"), "ui");
    await mkdir(join(to, "build"), { recursive: true });
    await writeFile(join(to, "build", "old.js"), "old");

    expect(await installPlugin(from, to)).toBe(join(to, "manifest.json"));
    expect((await readdir(to)).sort()).toEqual(["build", "manifest.json"]);
    expect((await readdir(join(to, "build"))).sort()).toEqual(["main.js", "ui.js"]);
  });

  it("are reported missing, with what to do, when the package has none", async () => {
    await expect(installPlugin(join(tmpdir(), "pixelwright-no-plugin"), join(tmpdir(), "x"))).rejects.toThrow(
      /manifest\.json/,
    );
  });
});

describe("setup --print", () => {
  it("prints every client's way in and the plugin's, for scripts and CI", () => {
    const text = setupText("/Users/me/.pixelwright/plugin/manifest.json");

    expect(text).toContain("claude mcp add pixelwright --scope user -- npx -y pixelwright@latest");
    expect(text).toContain('"pixelwright"');
    expect(text).toContain("[mcp_servers.pixelwright]");
    expect(text).toContain("/Users/me/.pixelwright/plugin/manifest.json");
  });
});
