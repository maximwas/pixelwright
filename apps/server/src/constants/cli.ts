/** The oldest Node.js the bundle runs on (`engines` in package.json says the same). */
export const MINIMUM_NODE_VERSION = "24.11.0";

export const HELP_TEXT = `pixelwright: an MCP server for Figma that works through the Pixelwright plugin.

  pixelwright                 in a terminal: the setup (MCP clients, the Figma plugin)
                              started by an MCP client: the MCP server on stdio
  pixelwright setup           the setup
  pixelwright setup --print   the commands and config blocks instead, for scripts and CI
  pixelwright serve           the MCP server, however it is started
  pixelwright --version
  pixelwright --help
`;

/** Shown on stderr when a person starts the server itself in a terminal. */
export const STARTED_IN_TERMINAL =
  "Pixelwright's MCP server waits for an MCP client on stdin. To set up your clients, run: npx -y pixelwright@latest\n";
