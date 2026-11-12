import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { SETUP_SETTINGS } from "@/cli/main/cli.tokens.ts";
import {
  ALREADY_EXISTS,
  CLIENT_ARGS,
  CLIENT_COMMAND,
  CLIENT_CONFIG,
  MCP_CLIENT,
  SETUP_TEXT,
  WINDOWS_NPX,
} from "@/cli/setup/setup.constants.ts";
import { CursorConfigSchema } from "@/cli/setup/setup.schema.ts";
import type { Invocation, McpClient } from "@/cli/setup/setup.types.ts";
import { PROCESS_RUNNER, type ProcessResult } from "@/core/ports/process-runner.port.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/**
 * The MCP clients the setup registers the server in (S-061), under the channel's name: Claude Code and Codex through
 * their own commands, Cursor's mcp.json merged with a backup, and the blocks to paste for the rest.
 */
@injectable()
export class McpClients {
  readonly #runner;
  readonly #settings;

  constructor(runner = inject(PROCESS_RUNNER), settings = inject(SETUP_SETTINGS)) {
    this.#runner = runner;
    this.#settings = settings;
  }

  /** The clients this computer seems to have: the claude command, Cursor's and Codex's folders. */
  async found(): Promise<McpClient[]> {
    const claude = await this.#runner.run(CLIENT_COMMAND.claude, CLIENT_ARGS.version);
    const home = this.#settings.userHome;

    return [
      ...(claude.code === 0 ? [MCP_CLIENT.claudeCode] : []),
      ...(existsSync(join(home, CLIENT_CONFIG.cursorFolder)) ? [MCP_CLIENT.cursor] : []),
      ...(existsSync(join(home, CLIENT_CONFIG.codexFolder)) ? [MCP_CLIENT.codex] : []),
    ];
  }

  /** Claude Code for every folder (`--scope user`); one already there is removed first, when `replace` says so. */
  async addToClaudeCode(replace: () => Promise<boolean>): Promise<string> {
    const { command, args } = this.#claudeInvocation();
    const added = [...CLIENT_ARGS.add, CHANNEL.name, ...CLIENT_ARGS.userScope, CLIENT_ARGS.end, command, ...args];
    let result = await this.#runner.run(CLIENT_COMMAND.claude, added);

    if (result.code === null) {
      throw new Error(SETUP_TEXT.claudeMissing(result.stderr.trim(), this.claudeCodeCommand()));
    }

    if (result.code !== 0 && ALREADY_EXISTS.test(this.#output(result))) {
      if (!(await replace())) {
        return SETUP_TEXT.claudeKeeps;
      }

      await this.#runner.run(CLIENT_COMMAND.claude, [...CLIENT_ARGS.remove, CHANNEL.name, ...CLIENT_ARGS.userScope]);
      result = await this.#runner.run(CLIENT_COMMAND.claude, added);
    }

    this.#ensureDone(CLIENT_COMMAND.claude, result);

    return SETUP_TEXT.claudeAdded;
  }

  /** `claude mcp add` as a person types it, for setup --print. */
  claudeCodeCommand(): string {
    const { command, args } = this.#claudeInvocation();

    return SETUP_TEXT.words([
      CLIENT_COMMAND.claude,
      ...CLIENT_ARGS.add,
      CHANNEL.name,
      ...CLIENT_ARGS.userScope,
      CLIENT_ARGS.end,
      command,
      ...args,
    ]);
  }

  /** Cursor's user config (~/.cursor/mcp.json), merged: other servers and keys stay, the old file is kept as .bak. */
  async addToCursor(replace: () => Promise<boolean>): Promise<string> {
    const file = join(this.#settings.userHome, CLIENT_CONFIG.cursorFolder, CLIENT_CONFIG.cursorFile);
    const current = await this.#cursorConfig(file);
    const servers = current?.mcpServers ?? {};
    const present = servers[CHANNEL.name];

    if (present !== undefined && isDeepStrictEqual(present, this.#entry())) {
      return SETUP_TEXT.cursorHas;
    }

    if (present !== undefined && !(await replace())) {
      return SETUP_TEXT.cursorKeeps;
    }

    await mkdir(dirname(file), { recursive: true });

    if (current !== null) {
      await copyFile(file, file + CLIENT_CONFIG.backup);
    }

    await writeFile(file, SETUP_TEXT.json({ ...current, mcpServers: { ...servers, [CHANNEL.name]: this.#entry() } }));

    return SETUP_TEXT.cursorAdded(file, current !== null);
  }

  /** Codex through its own command when it is on PATH (D-60); null when it is not, so the wizard shows the TOML. */
  async addToCodex(): Promise<string | null> {
    if ((await this.#runner.run(CLIENT_COMMAND.codex, CLIENT_ARGS.version)).code !== 0) {
      return null;
    }

    const { command, args } = this.#settings.invocation;
    const result = await this.#runner.run(CLIENT_COMMAND.codex, [
      ...CLIENT_ARGS.add,
      CHANNEL.name,
      CLIENT_ARGS.end,
      command,
      ...args,
    ]);

    this.#ensureDone(CLIENT_COMMAND.codex, result);

    return SETUP_TEXT.codexAdded;
  }

  /** What to add to Codex's config.toml, with time for the first download. */
  codexBlock(): string {
    const { command, args } = this.#settings.invocation;

    return SETUP_TEXT.codexToml(CHANNEL.name, command, args);
  }

  /** The mcpServers block other clients take. */
  configBlock(): string {
    return SETUP_TEXT.json({ mcpServers: { [CHANNEL.name]: this.#entry() } }).trimEnd();
  }

  /** Cursor's config, or null for none yet (no file, or the empty one Cursor can leave); a broken one is refused. */
  async #cursorConfig(file: string): Promise<zod.output<typeof CursorConfigSchema> | null> {
    const text = existsSync(file) ? await readFile(file, CLIENT_CONFIG.encoding) : "";

    if (text.trim() === "") {
      return null;
    }

    let json: unknown;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(SETUP_TEXT.notJson(file));
    }

    const config = zod.safeParse(CursorConfigSchema, json);

    if (!config.success) {
      throw new Error(SETUP_TEXT.notObject(file));
    }

    return config.data;
  }

  /** How Claude Code starts the server: npx through cmd /c on Windows, as its docs ask. */
  #claudeInvocation(): Invocation {
    const { invocation, platform } = this.#settings;

    return platform === WINDOWS_NPX.platform && invocation.command === WINDOWS_NPX.command
      ? { command: WINDOWS_NPX.shell, args: [...WINDOWS_NPX.shellArgs, invocation.command, ...invocation.args] }
      : invocation;
  }

  #entry(): { command: string; args: string[] } {
    return { command: this.#settings.invocation.command, args: [...this.#settings.invocation.args] };
  }

  /** Throws with what the client said when its `mcp add` failed. */
  #ensureDone(command: string, result: ProcessResult): void {
    if (result.code !== 0) {
      throw new Error(SETUP_TEXT.failed(command, this.#output(result) || SETUP_TEXT.exitCode(result.code)));
    }
  }

  /** What a command said, on either stream. */
  #output(result: ProcessResult): string {
    return (result.stderr + result.stdout).trim();
  }
}

export const MCP_CLIENTS = new InjectionToken<McpClients>("McpClients");
