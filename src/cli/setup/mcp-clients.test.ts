import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpClients } from "@/cli/setup/mcp-clients.ts";
import type { ProcessResult, ProcessRunner } from "@/core/ports/process-runner.port.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/** The user's real home, from the system's user database: HOME itself may point anywhere. */
const REAL_HOME = userInfo().homedir;

/**
 * A temp HOME and an empty PATH (m:c75e45d9: a test once reached the real `claude` and replaced the user's own
 * registration): whatever slips past the fake runner finds no binary, and a home inside the real one throws at once.
 */
function safeHome(): string {
  const home = mkdtempSync(join(tmpdir(), "pixelwright-cli-"));

  if (home.startsWith(REAL_HOME)) {
    throw new Error(`refusing a test home inside the real home: ${home}`);
  }

  vi.stubEnv("HOME", home);
  vi.stubEnv("PATH", "");
  vi.stubEnv("PIXELWRIGHT_HOME", "");

  return home;
}

/** A runner that records each command and answers in turn: it never starts a process. */
function fakeRunner(...answers: Partial<ProcessResult>[]) {
  const calls: string[] = [];
  const runner: ProcessRunner = {
    run: async (command, args) => {
      calls.push([command, ...args].join(" "));

      return { code: 0, stdout: "", stderr: "", ...answers[calls.length - 1] };
    },
  };

  return { calls, runner };
}

const NPX = { command: "npx", args: ["-y", "pixelwright@latest"] };

const ENTRY = { command: NPX.command, args: NPX.args };

/** The clients of a temp home, with this runner. */
function clientsWith(runner: ProcessRunner, platform: NodeJS.Platform = "darwin") {
  const userHome = safeHome();
  const pluginHome = join(userHome, CHANNEL.home, "plugin");

  return { userHome, clients: new McpClients(runner, { userHome, pluginHome, platform, invocation: NPX }) };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("McpClients", () => {
  it("adds the server to Claude Code under the channel's name, for every folder", async () => {
    const { calls, runner } = fakeRunner();

    expect(await clientsWith(runner).clients.addToClaudeCode(async () => true)).toMatch(/^Added to Claude Code/);
    expect(calls).toEqual([`claude mcp add ${CHANNEL.name} --scope user -- npx -y pixelwright@latest`]);
  });

  it("replaces Claude Code's entry when asked: removes it, then adds this one", async () => {
    const { calls, runner } = fakeRunner({
      code: 1,
      stderr: `MCP server ${CHANNEL.name} already exists in user config`,
    });

    expect(await clientsWith(runner).clients.addToClaudeCode(async () => true)).toMatch(/^Added/);
    expect(calls.map((call) => call.split(" ").slice(0, 3).join(" "))).toEqual([
      "claude mcp add",
      "claude mcp remove",
      "claude mcp add",
    ]);
  });

  it("says what to do when the claude command cannot run", async () => {
    const { runner } = fakeRunner({ code: null, stderr: "spawn claude ENOENT" });

    await expect(clientsWith(runner).clients.addToClaudeCode(async () => true)).rejects.toThrow(
      /could not run the claude command/,
    );
  });

  it("wraps npx in cmd /c for Claude Code on Windows, as its docs ask", async () => {
    const { calls, runner } = fakeRunner();
    const { clients } = clientsWith(runner, "win32");

    await clients.addToClaudeCode(async () => true);

    expect(calls[0]).toContain("-- cmd /c npx -y pixelwright@latest");
    expect(clients.claudeCodeCommand()).toContain(`claude mcp add ${CHANNEL.name} --scope user -- cmd /c npx`);
  });

  it("writes Cursor's config: a new one, an existing one with a backup, never an invalid one", async () => {
    const { userHome, clients } = clientsWith(fakeRunner().runner);
    const file = join(userHome, ".cursor", "mcp.json");
    const replace = async () => true;

    expect(await clients.addToCursor(replace)).toMatch(new RegExp(`^Added ${CHANNEL.name} to Cursor`));
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ mcpServers: { [CHANNEL.name]: ENTRY } });
    expect(await clients.addToCursor(replace)).toMatch(/already/);

    writeFileSync(file, JSON.stringify({ theme: "dark", mcpServers: { other: { command: "x" } } }));
    await clients.addToCursor(replace);
    expect(readdirSync(join(userHome, ".cursor")).sort()).toEqual(["mcp.json", "mcp.json.bak"]);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      theme: "dark",
      mcpServers: { other: { command: "x" }, [CHANNEL.name]: ENTRY },
    });

    writeFileSync(file, "{ broken");
    await expect(clients.addToCursor(replace)).rejects.toThrow(/not valid JSON/);
    expect(readFileSync(file, "utf8")).toBe("{ broken");
  });

  it("asks before replacing another entry of its name in Cursor, and keeps the same one in any key order", async () => {
    const { userHome, clients } = clientsWith(fakeRunner().runner);
    const file = join(userHome, ".cursor", "mcp.json");
    const custom = { mcpServers: { [CHANNEL.name]: { ...ENTRY, env: { PIXELWRIGHT_LOG_LEVEL: "debug" } } } };
    const unasked = async (): Promise<boolean> => {
      throw new Error("asked about the same entry");
    };

    mkdirSync(join(userHome, ".cursor"));
    writeFileSync(
      file,
      JSON.stringify({ mcpServers: { [CHANNEL.name]: { args: ENTRY.args, command: ENTRY.command } } }),
    );
    expect(await clients.addToCursor(unasked)).toMatch(/already/);
    expect(existsSync(`${file}.bak`)).toBe(false);

    writeFileSync(file, JSON.stringify(custom));
    expect(await clients.addToCursor(async () => false)).toMatch(/keeps/);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(custom);

    expect(await clients.addToCursor(async () => true)).toContain(`${file}.bak`);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ mcpServers: { [CHANNEL.name]: ENTRY } });
    expect(JSON.parse(readFileSync(`${file}.bak`, "utf8"))).toEqual(custom);
  });

  it("adds to Codex through its own command when it is on PATH (D-60), else gives the TOML to paste", async () => {
    const codex = fakeRunner();

    expect(await clientsWith(codex.runner).clients.addToCodex()).toMatch(/^Added to Codex/);
    expect(codex.calls).toEqual(["codex --version", `codex mcp add ${CHANNEL.name} -- npx -y pixelwright@latest`]);

    const none = fakeRunner({ code: null, stderr: "spawn codex ENOENT" });
    const { clients } = clientsWith(none.runner);

    expect(await clients.addToCodex()).toBeNull();
    expect(none.calls).toEqual(["codex --version"]);
    expect(clients.codexBlock()).toBe(
      `[mcp_servers.${CHANNEL.name}]\ncommand = "npx"\nargs = ["-y", "pixelwright@latest"]\nstartup_timeout_sec = 60`,
    );
    expect(JSON.parse(clients.configBlock())).toEqual({ mcpServers: { [CHANNEL.name]: ENTRY } });
  });
});
