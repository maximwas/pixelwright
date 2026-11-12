import type { SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addToClaudeCode, addToCursor, clientConfigBlock, codexBlock } from "../src/cli/clients.ts";
import { installPlugin } from "../src/cli/plugin-files.ts";
import { printSetup, setupText } from "../src/cli/setup-text.ts";
import { SERVER_INVOCATION } from "../src/constants/clients.ts";
import { parseCommand } from "../src/utils/cli-command.ts";
import { mergeMcpServer } from "../src/utils/mcp-config.ts";
import { claudeCodeInvocation } from "../src/utils/server-invocation.ts";

const temp = (name: string) => mkdtemp(join(tmpdir(), `pixelwright-${name}-`));

/** A built plugin as the npm package carries it: the manifest and the build folder. */
async function fakePlugin(): Promise<string> {
  const from = await temp("plugin-src");

  await mkdir(join(from, "build"));
  await writeFile(join(from, "manifest.json"), '{"name":"Pixelwright"}');
  await writeFile(join(from, "build", "main.js"), "main");
  await writeFile(join(from, "build", "ui.js"), "ui");

  return from;
}

/** What spawnSync gives for each call of `claude`, in turn, and the arguments it was called with. */
function claudeRuns(...results: Partial<SpawnSyncReturns<string>>[]) {
  const calls: string[][] = [];
  const run = (args: readonly string[]) => {
    calls.push([...args]);

    return {
      pid: 1,
      output: [],
      stdout: "",
      stderr: "",
      status: 0,
      signal: null,
      ...results[calls.length - 1],
    } as SpawnSyncReturns<string>;
  };

  return {
    calls,
    run,
  };
}

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
    expect(parseCommand(["logs"], true)).toEqual({ kind: "logs" });
    expect(parseCommand(["logs"], false)).toEqual({ kind: "logs" });
    expect(parseCommand(["logs", "--all"], true)).toMatchObject({ kind: "unknown" });
    expect(parseCommand(["publish"], true)).toEqual({
      kind: "unknown",
      argument: "publish",
    });
    expect(parseCommand(["setup", "--force"], true)).toEqual({
      kind: "unknown",
      argument: "setup --force",
    });
  });

  it("prints the setup instead of asking when nobody is at a terminal", () => {
    expect(parseCommand(["setup"], false)).toEqual({
      kind: "setup",
      print: true,
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
      replacing: false,
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
    const home = await temp("home");
    const file = join(home, ".cursor", "mcp.json");
    const replace = async () => true;

    expect(await addToCursor(SERVER_INVOCATION, home, replace)).toMatch(/^Added pixelwright to Cursor/);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ mcpServers: { pixelwright: entry } });
    expect(await addToCursor(SERVER_INVOCATION, home, replace)).toMatch(/already/);

    await writeFile(file, JSON.stringify({ mcpServers: { other: { command: "x" } } }));
    await addToCursor(SERVER_INVOCATION, home, replace);
    expect((await readdir(join(home, ".cursor"))).sort()).toEqual(["mcp.json", "mcp.json.bak"]);

    await writeFile(file, "{ broken");
    await expect(addToCursor(SERVER_INVOCATION, home, replace)).rejects.toThrow(/not valid JSON/);
    expect(await readFile(file, "utf8")).toBe("{ broken");
  });

  it("asks before replacing another pixelwright in Cursor, and keeps the same one in any key order", async () => {
    const home = await temp("home");
    const file = join(home, ".cursor", "mcp.json");
    const custom = {
      mcpServers: {
        pixelwright: {
          command: "npx",
          args: ["-y", "pixelwright@latest"],
          env: { PIXELWRIGHT_BRIDGE_PORT: "18800" },
        },
      },
    };
    const unasked = async (): Promise<boolean> => {
      throw new Error("asked about the same entry");
    };

    await mkdir(join(home, ".cursor"));
    await writeFile(
      file,
      JSON.stringify({
        mcpServers: {
          pixelwright: {
            args: entry.args,
            command: entry.command,
          },
        },
      }),
    );
    expect(await addToCursor(SERVER_INVOCATION, home, unasked)).toMatch(/already/);
    expect(existsSync(`${file}.bak`)).toBe(false);

    await writeFile(file, JSON.stringify(custom));
    expect(await addToCursor(SERVER_INVOCATION, home, async () => false)).toMatch(/keeps/);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(custom);

    expect(await addToCursor(SERVER_INVOCATION, home, async () => true)).toContain(`${file}.bak`);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ mcpServers: { pixelwright: entry } });
    expect(JSON.parse(await readFile(`${file}.bak`, "utf8"))).toEqual(custom);
  });

  it("says what to do when the claude command cannot run", async () => {
    const missing = Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" });
    // What spawnSync gives when the command is not there: no output at all, whatever its types say.
    const { run } = claudeRuns({
      status: null,
      stdout: undefined,
      stderr: undefined,
      error: missing,
    } as unknown as Partial<SpawnSyncReturns<string>>);

    await expect(addToClaudeCode(SERVER_INVOCATION, async () => true, run)).rejects.toThrow(
      /could not run the claude command/,
    );
  });

  it("replaces Claude Code's entry when asked: removes it, then adds this one", async () => {
    const { calls, run } = claudeRuns({
      status: 1,
      stderr: "MCP server pixelwright already exists in user config",
    });

    expect(await addToClaudeCode(SERVER_INVOCATION, async () => true, run)).toMatch(/^Added/);
    expect(calls.map((args) => args.slice(0, 2).join(" "))).toEqual(["mcp add", "mcp remove", "mcp add"]);
  });

  it("wraps npx in cmd /c for Claude Code on Windows, as its docs ask", () => {
    expect(claudeCodeInvocation(SERVER_INVOCATION, "win32")).toEqual({
      command: "cmd",
      args: ["/c", "npx", "-y", "pixelwright@latest"],
    });
    expect(claudeCodeInvocation(SERVER_INVOCATION, "darwin")).toBe(SERVER_INVOCATION);
    expect(
      setupText({
        manifest: null,
        platform: "win32",
      }),
    ).toContain("claude mcp add pixelwright --scope user -- cmd /c npx -y pixelwright@latest");
  });

  it("gives Codex's TOML, with time for the first download, and other clients' JSON to paste", () => {
    expect(codexBlock(SERVER_INVOCATION)).toBe(
      '[mcp_servers.pixelwright]\ncommand = "npx"\nargs = ["-y", "pixelwright@latest"]\nstartup_timeout_sec = 60',
    );
    expect(JSON.parse(clientConfigBlock(SERVER_INVOCATION))).toEqual({ mcpServers: { pixelwright: entry } });
  });
});

describe("the Figma plugin's files", () => {
  it("are copied where Figma Desktop can import the manifest from, replacing an older copy", async () => {
    const from = await fakePlugin();
    const to = join(await temp("home"), "plugin");

    await mkdir(join(to, "build"), { recursive: true });
    await writeFile(join(to, "manifest.json"), '{"name":"Pixelwright"}');
    await writeFile(join(to, "build", "old.js"), "old");

    expect(await installPlugin(from, to)).toBe(join(to, "manifest.json"));
    expect((await readdir(to)).sort()).toEqual(["build", "manifest.json"]);
    expect((await readdir(join(to, "build"))).sort()).toEqual(["main.js", "ui.js"]);
  });

  it("never replace a folder that holds something else", async () => {
    const to = join(await temp("home"), "plugin");

    await mkdir(to);
    await writeFile(join(to, "notes.txt"), "mine");

    await expect(installPlugin(await fakePlugin(), to)).rejects.toThrow(/not a Pixelwright plugin/);
    expect(await readFile(join(to, "notes.txt"), "utf8")).toBe("mine");
  });

  it("go into a Pixelwright folder only its owner can open", async () => {
    const home = join(await temp("home"), ".pixelwright");

    await installPlugin(await fakePlugin(), join(home, "plugin"));
    expect((await stat(home)).mode & 0o777).toBe(0o700);
  });

  it("are reported missing, with what to do, when the package has none", async () => {
    await expect(installPlugin(join(tmpdir(), "pixelwright-no-plugin"), join(tmpdir(), "x"))).rejects.toThrow(
      /manifest\.json/,
    );
  });
});

describe("setup --print", () => {
  it("prints every client's way in and the plugin's, for scripts and CI", () => {
    const text = setupText({
      manifest: "/Users/me/.pixelwright/plugin/manifest.json",
      platform: "darwin",
    });

    expect(text).toContain("claude mcp add pixelwright --scope user -- npx -y pixelwright@latest");
    expect(text).toContain('"pixelwright"');
    expect(text).toContain("[mcp_servers.pixelwright]");
    expect(text).toContain("/Users/me/.pixelwright/plugin/manifest.json");
  });

  it("puts the plugin where the path it prints says", async () => {
    const pluginHome = join(await temp("home"), "plugin");
    const text = await printSetup({
      from: await fakePlugin(),
      pluginHome,
      platform: "darwin",
    });

    expect(text).toContain(join(pluginHome, "manifest.json"));
    expect(existsSync(join(pluginHome, "manifest.json"))).toBe(true);
  });

  it("says where the plugin comes from when this copy has none", async () => {
    const text = await printSetup({
      from: null,
      pluginHome: join(await temp("home"), "plugin"),
      platform: "darwin",
    });

    expect(text).toContain("npx -y pixelwright@latest setup --print");
    expect(text).not.toContain("manifest.json");
  });
});
