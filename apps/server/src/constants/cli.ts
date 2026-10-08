/** The oldest Node.js the bundle runs on (`engines` in package.json says the same). */
export const MINIMUM_NODE_VERSION = "24.11.0";

export const VERSION_FLAGS: ReadonlySet<string> = new Set(["--version", "-v", "version"]);

export const HELP_FLAGS: ReadonlySet<string> = new Set(["--help", "-h", "help"]);

export const HELP_TEXT = `pixelwright: an MCP server for Figma that works through the Pixelwright plugin.

  pixelwright            the MCP server on stdio (MCP clients start it)
  pixelwright --version
  pixelwright --help

Add it to Claude Code: claude mcp add pixelwright -- npx -y pixelwright@latest
`;

/** Shown on stderr when a person, not an MCP client, starts the server in a terminal. */
export const STARTED_IN_TERMINAL =
  "Pixelwright is an MCP server and waits for an MCP client on stdin. Add it to your client instead: claude mcp add pixelwright -- npx -y pixelwright@latest\n";
