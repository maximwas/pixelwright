import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CODEX_STARTUP_TIMEOUT_SEC, CURSOR_CONFIG_PATH, SERVER_NAME } from "../constants/clients.ts";
import type { ClaudeRun, Invocation, McpClient } from "../types/cli.ts";
import { mergeMcpServer } from "../utils/mcp-config.ts";

/** Runs the `claude` command. npm installs it as claude.cmd on Windows, which only a shell starts. */
export function runClaude(args: readonly string[]): SpawnSyncReturns<string> {
  return process.platform === "win32"
    ? spawnSync(["claude", ...args].join(" "), {
        encoding: "utf8",
        shell: true,
      })
    : spawnSync("claude", args, { encoding: "utf8" });
}

/** The clients this computer seems to have: the `claude` command, Cursor's and Codex's folders. */
export function detectClients(home: string, run: ClaudeRun = runClaude): McpClient[] {
  const found: McpClient[] = [];

  if (run(["--version"]).status === 0) {
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
 * old entry is removed first. Resolves with what happened, in words; rejects with what to do when it could not.
 */
export async function addToClaudeCode(
  server: Invocation,
  replace: () => Promise<boolean>,
  run: ClaudeRun = runClaude,
): Promise<string> {
  const command = [server.command, ...server.args].join(" ");
  const add = () => run(["mcp", "add", SERVER_NAME, "--scope", "user", "--", server.command, ...server.args]);
  let result = add();

  if (result.error !== undefined) {
    throw new Error(
      `Pixelwright could not run the claude command (${result.error.message}): install Claude Code, or add Pixelwright to it later with: claude mcp add ${SERVER_NAME} --scope user -- ${command}`,
    );
  }

  if (result.status !== 0 && /already exists/i.test(outputOf(result))) {
    if (!(await replace())) {
      return "Claude Code keeps the Pixelwright it had.";
    }

    run(["mcp", "remove", SERVER_NAME, "--scope", "user"]);
    result = add();
  }

  if (result.status !== 0) {
    throw new Error(`claude mcp add failed: ${outputOf(result) || `exit code ${result.status}`}`);
  }

  return "Added to Claude Code for every folder.";
}

/**
 * Adds the server to Cursor's user config (~/.cursor/mcp.json); the old file is kept as mcp.json.bak. Another
 * pixelwright entry there is replaced only when `replace` says so.
 */
export async function addToCursor(server: Invocation, home: string, replace: () => Promise<boolean>): Promise<string> {
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

  const { config, changed, replacing } = mergeMcpServer(current, SERVER_NAME, {
    command: server.command,
    args: [...server.args],
  });

  if (!changed) {
    return `Cursor has ${SERVER_NAME} already.`;
  }

  if (replacing && !(await replace())) {
    return `Cursor keeps the ${SERVER_NAME} it had.`;
  }

  await mkdir(dirname(file), { recursive: true });

  if (current !== null) {
    await copyFile(file, `${file}.bak`);
  }

  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);

  return `Added ${SERVER_NAME} to Cursor (${file}${current === null ? "" : `; the previous file is ${file}.bak`}). Restart Cursor to load it.`;
}

/** What to add to Codex's config.toml: the wizard does not edit TOML. */
export function codexBlock(server: Invocation): string {
  const quoted = (value: string) => JSON.stringify(value);

  return [
    `[mcp_servers.${SERVER_NAME}]`,
    `command = ${quoted(server.command)}`,
    `args = [${server.args.map(quoted).join(", ")}]`,
    `startup_timeout_sec = ${CODEX_STARTUP_TIMEOUT_SEC}`,
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

/** What a command said, on either stream; spawnSync leaves both unset when the command could not start. */
function outputOf(result: SpawnSyncReturns<string>): string {
  return `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
}
