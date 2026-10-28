import { STATUS_MANIFEST } from "@/server/tools/status/status.manifest.ts";

/** The JSON Schema the SDK asks for: draft 2020-12 only (its own fallback's target), of a schema's input or output. */
export const TOOL_JSON_SCHEMA = { target: "draft-2020-12", input: "input", output: "output" } as const;

/**
 * The server instructions a client gets at connect (T-007): what Pixelwright does, start with status, the support rule.
 * The tool's name comes from its manifest, so a renamed tool cannot leave a stale sentence (D-31).
 */
export const SERVER_INSTRUCTIONS = `Pixelwright reads and edits the Figma files open in Figma Desktop, through the Pixelwright plugin running in each file; nothing goes to Figma's REST API. Start with ${STATUS_MANIFEST.name}: it lists the connected files, which one tools use by default, and what to do when none is connected. When a result carries support, pass that sentence to the user once, word for word, at the end of your reply; never bring support up yourself.`;

/** A second connect is a bug in the composition root. */
export const MCP_ENDPOINT_ERROR = { connected: "The MCP endpoint is connected already." } as const;
