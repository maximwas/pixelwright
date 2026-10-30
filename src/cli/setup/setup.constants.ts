import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/** The clients the wizard offers (S-061). */
export const MCP_CLIENT = { claudeCode: "claude-code", cursor: "cursor", codex: "codex", other: "other" } as const;

export const MCP_CLIENT_OPTIONS = [
  { value: MCP_CLIENT.claudeCode, label: "Claude Code" },
  { value: MCP_CLIENT.cursor, label: "Cursor" },
  { value: MCP_CLIENT.codex, label: "Codex" },
  { value: MCP_CLIENT.other, label: "Another MCP client" },
] as const;

/** How release clients start the server: always the newest release from npm. */
export const NPX_INVOCATION = { command: "npx", args: ["-y", "pixelwright@latest"] } as const;

/** Claude Code's docs ask Windows users to start npx through cmd /c. */
export const WINDOWS_NPX = { platform: "win32", command: "npx", shell: "cmd", shellArgs: ["/c"] } as const;

/** The clients' commands and their arguments. */
export const CLIENT_COMMAND = { claude: "claude", codex: "codex" } as const;

export const CLIENT_ARGS = {
  version: ["--version"],
  add: ["mcp", "add"],
  remove: ["mcp", "remove"],
  userScope: ["--scope", "user"],
  end: "--",
} as const;

/** What `claude mcp add` says when the name is taken. */
export const ALREADY_EXISTS = /already exists/i;

/** Where each client keeps its user-wide config, and how the setup reads and writes it. */
export const CLIENT_CONFIG = {
  cursorFolder: ".cursor",
  cursorFile: "mcp.json",
  codexFolder: ".codex",
  codexFile: "config.toml",
  backup: ".bak",
  encoding: "utf8",
} as const;

/** Codex gives a server 10 s to start by default; the first start through npx downloads the package first. */
const CODEX_STARTUP_TIMEOUT_SEC = 60;

/** The plugin in the package and in the channel's home: dist/plugin beside the bundle, else the repository's build. */
export const PLUGIN_FILE = {
  manifest: "manifest.json",
  folder: "plugin",
  sources: ["./plugin/", "../../../dist/plugin/"],
  encoding: "utf8",
} as const;

/** The channel's home also keeps the pairing keys (bridge.json): only its owner opens it. */
export const HOME_MODE = 0o700;

/** How many of a foreign folder's entries the refusal names. */
const NAMED_ENTRIES = 3;

export const SETUP_ERROR = { cancelled: "SetupCancelled" } as const;

export const SETUP_TEXT = {
  intro: `${CHANNEL.pluginName}: AI agents that read and edit your Figma files`,
  pick: `Where should ${CHANNEL.name} be available? (space to pick, enter to go on)`,
  found: "found on this computer",
  claudeAdding: "Adding to Claude Code…",
  claudeHas: `Claude Code has ${CHANNEL.name} already.`,
  replace: "Replace it with this one?",
  claudeKeeps: `Claude Code keeps the ${CHANNEL.name} it had.`,
  claudeAdded: "Added to Claude Code for every folder.",
  claudeMissing: (reason: string, command: string) =>
    `Pixelwright could not run the claude command (${reason}): install Claude Code, or add it later with: ${command}`,
  failed: (command: string, output: string) => `${command} mcp add failed: ${output}`,
  exitCode: (code: number | null) => `exit code ${code}`,
  cursorReplace: `Cursor has another ${CHANNEL.name} set up. Replace it with this one?`,
  cursorHas: `Cursor has ${CHANNEL.name} already.`,
  cursorKeeps: `Cursor keeps the ${CHANNEL.name} it had.`,
  cursorAdded: (file: string, backup: boolean) =>
    `Added ${CHANNEL.name} to Cursor (${file}${backup ? `; the previous file is ${file}.bak` : ""}). Restart Cursor to load it.`,
  notJson: (file: string) => `${file} is not valid JSON, so it was left as it is.`,
  notObject: (file: string) =>
    `${file} does not hold a JSON object with an mcpServers object, so it was left as it is.`,
  codexAdded: `Added to Codex. If its first start times out, add startup_timeout_sec = ${CODEX_STARTUP_TIMEOUT_SEC} under [mcp_servers.${CHANNEL.name}] in ~/.codex/config.toml.`,
  codexTitle: (file: string) => `Add to ${file}`,
  otherTitle: "Add to your MCP client's config",
  noPlugin: "This copy of Pixelwright has no built Figma plugin: install pixelwright from npm to get it.",
  placePlugin: (home: string) =>
    `Put the Figma plugin in ${home}, where Figma Desktop can import it? Its windows open in Figma reload.`,
  placed: (home: string) => `The Figma plugin is in ${home}; its open windows reload with it.`,
  importPlugin: (manifest: string) =>
    `Figma Desktop → Plugins → Development → Import plugin from manifest… → ${manifest}`,
  runPlugin: `Open your file and run Plugins → Development → ${CHANNEL.pluginName}; keep its window open.`,
  pair: "The first time, your agent shows a pairing code: type it into that window.",
  allowEdits: "Turn on Allow edits there when the agent should change the file.",
  closing: (steps: readonly string[], restart: boolean) =>
    [
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      ...(restart ? ["", `Restart your MCP client so it loads ${CHANNEL.name}.`] : []),
    ].join("\n"),
  nextTitle: "Next, in Figma",
  done: "Done.",
  cancelled: "Setup cancelled.",
  noManifest: (from: string) =>
    `No plugin in ${from} (manifest.json is missing): reinstall pixelwright, or build the plugin.`,
  notPluginFolder: (to: string, entries: readonly string[]) =>
    `${to} is not a ${CHANNEL.pluginName} plugin folder (it holds ${entries.slice(0, NAMED_ENTRIES).join(", ")}${entries.length > NAMED_ENTRIES ? ", …" : ""}), so it was left as it is: move those files, or set PIXELWRIGHT_HOME to another folder.`,
  words: (words: readonly string[]) => words.join(" "),
  json: (value: unknown) => `${JSON.stringify(value, null, 2)}\n`,
  codexToml: (
    name: string,
    command: string,
    args: readonly string[],
  ) =>
    [
      `[mcp_servers.${name}]`,
      `command = ${JSON.stringify(command)}`,
      `args = [${args.map((arg) => JSON.stringify(arg)).join(", ")}]`,
      `startup_timeout_sec = ${CODEX_STARTUP_TIMEOUT_SEC}`,
    ].join("\n"),
  print: (blocks: readonly string[]) => `${blocks.join("\n\n")}\n`,
  line: (text: string) => `${text}\n`,
  claudeBlock: (command: string) => `Claude Code:\n  ${command}`,
  cursorBlock: (json: string) => `Cursor (~/.cursor/mcp.json), or any client with an mcpServers config:\n${json}`,
  codexBlock: (toml: string) => `Codex (~/.codex/config.toml), unless its codex mcp add did it:\n${toml}`,
  pluginNone:
    "Figma plugin: this copy of Pixelwright has none. Get it from npm with: npx -y pixelwright@latest setup --print",
  pluginBlock: (manifest: string) =>
    [
      "Figma plugin, in Figma Desktop (its open windows reload with this copy):",
      `  Plugins → Development → Import plugin from manifest… → ${manifest}`,
      `  Then open your file, run Plugins → Development → ${CHANNEL.pluginName} and keep its window open.`,
    ].join("\n"),
} as const;
