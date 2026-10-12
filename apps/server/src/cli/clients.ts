import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CURSOR_CONFIG_PATH, SERVER_NAME } from "../constants/clients.ts";
import type { Invocation, McpClient } from "../types/cli.ts";
import { mergeMcpServer } from "../utils/mcp-config.ts";

/** The clients this computer seems to have: the `claude` command, Cursor's and Codex's folders. */
export function detectClients(home: string): McpClient[] {
  const found: McpClient[] = [];

  if (spawnSync("claude", ["--version"], { stdio: "ignore" }).status === 0) {
    found.push("claude-code");
  }

  if (existsSync(join(home, ".cursor"))) {
    found.push("cursor");
  }

  if (existsSync(join(home, ".codex"))) {
    found.push("codex");
  }

  return found;
}

/**
 * Adds the server to Claude Code for every folder (`--scope user`). When one is there already, `replace` decides; the
 * old entry is removed first. Resolves with what happened, in words.
 */
export async function addToClaudeCode(server: Invocation, replace: () => Promise<boolean>): Promise<string> {
  const add = () =>
    spawnSync("claude", ["mcp", "add", SERVER_NAME, "--scope", "user", "--", server.command, ...server.args], {
      encoding: "utf8",
    });
  let result = add();

  if (result.status !== 0 && /already exists/i.test(`${result.stderr}${result.stdout}`)) {
    if (!(await replace())) {
      return "Claude Code keeps the Pixelwright it had.";
    }

    spawnSync("claude", ["mcp", "remove", SERVER_NAME, "--scope", "user"], { stdio: "ignore" });
    result = add();
  }

  if (result.status !== 0) {
    throw new Error(`claude mcp add failed: ${(result.stderr || result.stdout).trim()}`);
  }

  return "Added to Claude Code for every folder.";
}

/** Adds the server to Cursor's user config (~/.cursor/mcp.json); the old file is kept as mcp.json.bak. */
export async function addToCursor(server: Invocation, home: string): Promise<string> {
  const file = join(home, ...CURSOR_CONFIG_PATH);
  let current: unknown = null;

  if (existsSync(file)) {
    const text = await readFile(file, "utf8");

    try {
      // Cursor can leave an empty file behind: no config yet, not a broken one.
      current = text.trim() === "" ? null : JSON.parse(text);
    } catch {
      throw new Error(`${file} is not valid JSON, so it was left as it is.`);
    }
  }

  const { config, changed } = mergeMcpServer(current, SERVER_NAME, {
    command: server.command,
    args: [...server.args],
  });

  if (!changed) {
    return `Cursor has ${SERVER_NAME} already.`;
  }

  await mkdir(dirname(file), { recursive: true });

  if (current !== null) {
    await copyFile(file, `${file}.bak`);
  }

  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);

  return `Added ${SERVER_NAME} to Cursor (${file}). Restart Cursor to load it.`;
}

/** What to add to Codex's config.toml: the wizard does not edit TOML. */
export function codexBlock(server: Invocation): string {
  const quoted = (value: string) => JSON.stringify(value);

  return [
    `[mcp_servers.${SERVER_NAME}]`,
    `command = ${quoted(server.command)}`,
    `args = [${server.args.map(quoted).join(", ")}]`,
  ].join("\n");
}

/** The mcpServers block other clients take. */
export function clientConfigBlock(server: Invocation): string {
  return JSON.stringify(
    {
      mcpServers: {
        [SERVER_NAME]: {
          command: server.command,
          args: server.args,
        },
      },
    },
    null,
    2,
  );
}
