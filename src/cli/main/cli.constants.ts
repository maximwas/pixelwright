/** The commands the binary knows (S-060); `unknown` is whatever else it was given. */
export const COMMAND = {
  serve: "serve",
  setup: "setup",
  setupPrint: "setup --print",
  logs: "logs",
  version: "version",
  help: "help",
  unknown: "unknown",
} as const;

/** parseArgs' options: `--print` for setup; `--version` (-v) and `--help` (-h). */
export const CLI_OPTIONS = {
  print: { type: "boolean" },
  version: { type: "boolean", short: "v" },
  help: { type: "boolean", short: "h" },
} as const;

/** Each command line the binary knows, as its words then its options, and what it runs; none and `setup` ask the terminal. */
export const COMMAND_LINES: Readonly<Record<string, (typeof COMMAND)[keyof typeof COMMAND]>> = {
  serve: COMMAND.serve,
  "setup --print": COMMAND.setupPrint,
  logs: COMMAND.logs,
  version: COMMAND.version,
  "--version": COMMAND.version,
  help: COMMAND.help,
  "--help": COMMAND.help,
};

/** How an option is written back into a command line, and how its words join. */
export const COMMAND_LINE_WORD = { option: (name: string) => `--${name}`, separator: " " } as const;

/** Exit codes: done, failed or cancelled, and a command the binary does not know. */
export const EXIT_CODE = { ok: 0, failed: 1, unknown: 2 } as const;

/** The oldest Node that runs it: Code Connect strips TypeScript with stripTypeScriptTypes and reads fs.glob (D-59). */
export const NODE_MINIMUM = "24.11.0";

export const CLI_TEXT = {
  nodeTooOld: (found: string) => `Pixelwright needs Node.js ${NODE_MINIMUM} or newer; you have ${found}.\n`,
  version: (version: string) => `${version}\n`,
  unknown: (argument: string, help: string) => `Unknown command: ${argument}\n\n${help}`,
  startedInTerminal:
    "The MCP server is running on stdio: MCP clients start it themselves. To set it up, run it with no command in a terminal. Ctrl+C stops it.\n",
  help: [
    "Usage: pixelwright [command]",
    "",
    "  (none)          In a terminal, the setup; started by an MCP client, the MCP server on stdio.",
    "  serve           The MCP server on stdio, always.",
    "  setup           The setup: MCP clients, the Figma plugin, what to do in Figma.",
    "  setup --print   The plugin put in place, and every client's command or config printed, with no questions.",
    "  logs            Follows the log every running server writes (Ctrl+C stops it).",
    "  --version, -v   The version.",
    "  --help, -h      This help.",
    "",
  ].join("\n"),
} as const;
