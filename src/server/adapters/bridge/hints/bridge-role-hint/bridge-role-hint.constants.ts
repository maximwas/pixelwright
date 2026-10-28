/** The hint of a bridge that is off, broken, handed over or out of reach; an unreachable one names who holds the port. */
export const BRIDGE_ROLE_HINT = {
  disabled: "The plugin bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): remove the variable and restart the MCP server.",
  failed: (failure: string | null) => `The plugin bridge could not start: ${failure ?? "no reason was given."}`,
  handedOver:
    "A newer Pixelwright server, another MCP client's, took the Figma bridge over, so this one switched its bridge off: restart Pixelwright in this MCP client (/mcp in Claude Code) to reach Figma again.",
  takingOver: (port: number) =>
    `A newer Pixelwright server is taking the bridge over on port ${port}: this session joins it in a moment.`,
  otherVersion: (port: number) =>
    `Another MCP client session runs another Pixelwright version and holds port ${port}: run the same version in both, or close that session. This one keeps retrying.`,
  notPixelwright: (port: number) =>
    `Port ${port} is held by a program that is not Pixelwright: free it. This session keeps retrying.`,
} as const;
