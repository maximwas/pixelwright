/** The hint while the bridge is up and no file is connected: where to start the plugin. */
export const NO_FILE_HINT = {
  text: (plugin: string) =>
    `No Figma file is connected: open the file in Figma Desktop, run Plugins → Development → ${plugin}, and keep the plugin window open.`,
} as const;

/** The hint after a connection was refused: a plugin set up wrong, or a stranger knocking (S-003). */
export const REJECTION_HINT = {
  text: (
    origin: string | null | undefined,
    reason: string | undefined,
    plugin: string,
  ) =>
    `A connection from origin ${origin ?? "(none)"} was refused (${reason}): if it was not the ${plugin} plugin, ignore it.`,
} as const;

/** The hint while pairing is paused after too many wrong codes: someone may be guessing (S-021). */
export const PAIRING_LOCK_HINT = {
  text: (lockedForSeconds: number | null | undefined) =>
    `Pairing is paused for ${lockedForSeconds} s: too many wrong codes were typed for a waiting plugin, possibly by another program on this computer (a web page can try). Ask the user to wait, then call status again for a new code.`,
} as const;

/** The hint while a plugin waits with a code in force: the model relays the code and never types it (S-020, D-08). */
export const PAIRING_CODE_HINT = {
  text: (
    code: string | null | undefined,
    plugin: string,
    expiresInSeconds: number | null | undefined,
  ) =>
    `A plugin is waiting to be paired: ask the user to type ${code} into the ${plugin} window in Figma (valid for ${expiresInSeconds} s). Only the user types it; never type or send it anywhere yourself.`,
} as const;

/** The hint after a plugin of another protocol was turned away (S-003, S-004); `plugin` names it with its version. */
export const PROTOCOL_REFUSAL_HINT = {
  plugin: (name: string, version: string | null) =>
    version === null ? `The ${name} plugin` : `The ${name} plugin ${version}`,
  older: (
    plugin: string,
    protocol: number,
    required: number,
  ) =>
    `${plugin} that tried to connect is older than this server (protocol ${protocol}; this server speaks ${required}), so it was turned away: ask the user to install the plugin that comes with this server's version and run it again in Figma.`,
  newer: (
    plugin: string,
    protocol: number,
    required: number,
  ) =>
    `${plugin} that tried to connect is newer than this server (protocol ${protocol}; this server speaks ${required}), so it was turned away: update this Pixelwright server and restart it in this MCP client (/mcp in Claude Code).`,
} as const;

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
